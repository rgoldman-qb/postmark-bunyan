var postmark    = require('postmark');
var _           = require('lodash');
var RateLimiter = require('limiter').RateLimiter;

var LEVELS = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL'
};

var defaultBodyFormatter = function (record) {
  var rows = [];
  rows.push('level:     ' + LEVELS[record.level]);
  rows.push('name:      ' + record.name);
  rows.push('hostname:  ' + record.hostname);
  rows.push('pid:       ' + record.pid);
  rows.push('time:      ' + record.time);

  if (record.msg) {
    rows.push('msg:       ' + record.msg);
  }

  if (record.err) {
    rows.push('err.stack: ' + record.err.stack);
  }

  return rows.join('\n');
};

var defaultSubjectFormatter = function (record) {
  return '' + LEVELS[record.level] + ' from ' + record.name + ': ' + record.msg.substring(0, 12) + ' ...'
};

/**
 * PostmarkBunyan constructor
 *
 * @param {Object} options
 * @constructor
 */
function PostmarkBunyan(options) {
  if (_.isUndefined(options) || _.isNull(options) || !_.isObject(options)) {
    throw new TypeError('options object must be provided');
  }

  // Validate serverApiToken
  if (!_.isString(options.serverApiToken)) {
    throw new TypeError('serverApiToken must be a string');
  } else {
    this.key = options.serverApiToken;
  }

  // Validate toEmail
  if (!_.isArray(options.toEmail) || !_.every(options.toEmail, _.isString)) {
    throw new TypeError('toEmail must be an array of strings (email addresses)');
  } else {
    if (_.isArray(options.toEmail)) {
      this.toEmail = options.toEmail.join();
    } else {
      this.toEmail = options.toEmail;
    }
  }

  // Validate rate limit
  if (_.isUndefined(options.rateLimit) || _.isNull(options.rateLimit)) {
    this.rateLimiter = null;
  } else if (!_.isObject(options.rateLimit) || !_.isString(options.rateLimit.interval) || !_.isNumber(options.rateLimit.value)) {
    throw new TypeError('if provided, rateLimit must be an object with string property interval and number property value');
  } else {
    this.rateLimiter           = new RateLimiter(options.rateLimit.value, options.rateLimit.interval, true);
    this.__RATE_LIMIT_RETRY_MS = this.rateLimiter.tokenBucket.interval / 2;
  }

  this.__rateLimitedQueue = [];
  this.__resendTimeout    = null;

  // Validate fromEmail
  if (!_.isString(options.fromEmail)) {
    throw new TypeError('fromEmail must be a string (single email)');
  } else {
    this.fromEmail = options.fromEmail;
  }

  // Validate bodyIsHtml
  if (_.isUndefined(options.bodyIsHtml) || _.isNull(options.bodyIsHtml)) {
    this.bodyIsHtml = false;
  } else if (!_.isBoolean(options.bodyIsHtml)) {
    throw new TypeError('if provided, bodyIsHtml must be a boolean');
  } else {
    this.bodyIsHtml = options.bodyIsHtml;
  }

  // Validate bodyFormatter
  if (_.isUndefined(options.bodyFormatter) || _.isNull(options.bodyFormatter)) {
    this.bodyFormatter = defaultBodyFormatter;
  } else if (!_.isFunction(options.bodyFormatter)) {
    throw new TypeError('if provided, bodyFormatter must be a function');
  } else {
    this.bodyFormatter = options.bodyFormatter;
  }

  // Validate subjectFormatter
  if (_.isUndefined(options.subjectFormatter) || _.isNull(options.subjectFormatter)) {
    this.subjectFormatter = defaultSubjectFormatter;
  } else if (!_.isFunction(options.subjectFormatter)) {
    throw new TypeError('if provided, subjectFormatter must be a function');
  } else {
    this.subjectFormatter = options.subjectFormatter;
  }

  // Validate onSuccess
  if (_.isUndefined(options.onSuccess) || _.isNull(options.onSuccess)) {
    this.onSuccess = null;
  } else if (!_.isFunction(options.onSuccess)) {
    throw new TypeError('if provided, onSuccess must be a function')
  } else {
    this.onSuccess = options.onSuccess;
  }

  // Validate onError
  if (_.isUndefined(options.onError) || _.isNull(options.onError)) {
    this.onError = null;
  } else if (!_.isFunction(options.onError)) {
    throw new TypeError('if provided, onError must be a function')
  } else {
    this.onError = options.onError;
  }

  var self      = this;
  this.__client = new postmark.Client(this.key);

  /**
   * Generate message object for postmark API
   * @param record
   * @private
   */
  this.__generateMessage = function (record) {
    var body    = self.bodyFormatter(record);
    var subject = self.subjectFormatter(record);

    var message = {
      From:    self.fromEmail,
      To:      self.toEmail,
      Subject: subject
    };

    if (self.bodyIsHtml) { message.HtmlBody = body; }
    else { message.TextBody = body; }

    return message;
  };


  /**
   * Rate limit send to postmark
   * @param message
   * @private
   */
  this.__rateLimitSend = function (message) {
    self.__rateLimitedQueue.push(message);
    tryFlushingQueue();
  };

  var tryFlushingQueue = function () {
    self.rateLimiter.removeTokens(1, function (err, remainingRequests) {
      // If email is rate limited, make sure there is a timeout to clear it later
      if (remainingRequests < 0) {
        if (_.isNull(self.__resendTimeout)) {
          self.__resendTimeout = setTimeout(function () {
            self.__resendTimeout = null;
            tryFlushingQueue();
          }, self.__RATE_LIMIT_RETRY_MS);
        }
      }
      else if (self.__rateLimitedQueue.length > 0) {
        sendAndClearQueue();
      }
    });
  };

  /**
   * Immediately sends entire queue, and cancels the timeout if it exists
   */
  var sendAndClearQueue = function () {
    var message             = buildBacklogMessage(self.__rateLimitedQueue);
    self.__rateLimitedQueue = [];

    if (!_.isNull(self.__resendTimeout)) {
      clearTimeout(self.__resendTimeout);
      self.__resendTimeout = null;
    }

    self.__send(message);
  };

  /**
   * Send message using postmark
   * @param message
   * @private
   */
  this.__send = function (message) {
    self.__client.sendEmail(message, function (error, result) {
      if (error) {

        if (_.isFunction(self.onError)) {
          self.onError(error);
          return;
        } else {
          console.error("Unable to send via postmark: " + error.status + ' message ' + error.message);
          return;
        }
      }

      if (_.isFunction(self.onSuccess)) {
        self.onSuccess(result);
      }
    });
  };
}

/**
 * Write function to be called be bunyan
 * @param record
 */
PostmarkBunyan.prototype.write = function (record) {
  var self = this;

  var message = self.__generateMessage(record);

  // If there is a rate limiter, use it
  if (!_.isNull(self.rateLimiter)) {
    self.__rateLimitSend(message);
  } else {
    self.__send(message);
  }
};

/**
 * Converts message array into single message
 * @param messages
 * @returns {{From: *, To: (*|string), Subject: (*|subject)}}
 */
var buildBacklogMessage = function (messages) {
  var isHtml     = _.isUndefined(messages[0].TextBody);
  var lineBreak  = isHtml ? '<br>' : '\n';
  var concatBody = '';

  _.forEach(messages, function (message) {
    if (concatBody.length > 0) {
      concatBody += lineBreak;
      concatBody += lineBreak;
    }

    var body = isHtml ? message.HtmlBody : message.TextBody;

    concatBody += body;
  });

  var message = {
    From:    messages[0].From,
    To:      messages[0].To,
    Subject: messages[0].Subject
  };

  if (isHtml) { message.HtmlBody = concatBody; }
  else { message.TextBody = concatBody; }

  return message;
};

module.exports = PostmarkBunyan;