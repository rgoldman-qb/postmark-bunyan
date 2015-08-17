var postmark = require('postmark');
var _        = require('lodash');

var LEVELS = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL'
};

var defaultBodyFormatter    = function (record) {
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
  return '' + LEVELS[record.level] + ' from ' + record.name + ': ' + record.msg.substring(0,12) + ' ...'
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

  this.__client = new postmark.Client(this.key);

  /**
   * Generate message object for postmark API
   * @param record
   * @private
   */
  this.__generateMessage = function(record){
    var body    = this.bodyFormatter(record);
    var subject = this.subjectFormatter(record);

    var message = {
      From:    this.fromEmail,
      To:      this.toEmail,
      Subject: subject
    };

    if (this.bodyIsHtml) { message.HtmlBody = body; }
    else { message.TextBody = body; }

    return message;
  }
}

/**
 * Write function to be called be bunyan
 * @param record
 */
PostmarkBunyan.prototype.write = function (record) {
  var self = this;

  this.__client.sendEmail(this.__generateMessage(record), function (error, result) {
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

module.exports = PostmarkBunyan;