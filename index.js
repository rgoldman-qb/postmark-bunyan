var postmark = require('postmark');


var defaultBodyFormatter    = function (record) {
  console.log(record);
};
var defaultSubjectFormatter = function (record) {
  console.log(record);
};

function PostmarkBunyan(options) {
  if (!_.isString(options.serverKey)) {
    throw new TypeError('serverKey must be a string');
  } else {
    this.key = options.serverKey;
  }

  if (!_.isArray(options.toEmail) || !_.every(options.toEmail, _.isString)) {
    throw new TypeError('toEmail must be an array of strings (email addresses)');
  } else {
    if (_.isArray(options.toEmail)) {
      this.toEmail = options.toEmail.join();
    } else {
      this.toEmail = options.toEmail;
    }
  }

  if (!_.isArray(options.fromEmail) || !_.every(options.fromEmail, _.isString)) {
    throw new TypeError('fromEmail must be an array of strings (email addresses)');
  } else {
    this.fromEmail = options.fromEmail;
  }

  if (_.isUndefined(options.bodyIsHtml) || _.isNull(options.bodyIsHtml)) {
    this.bodyIsHtml = false;
  } else if (!_.isBoolean(options.bodyIsHtml)) {
    throw new TypeError('if provided, bodyIsHtml must be a boolean');
  } else {
    this.bodyIsHtml = options.bodyIsHtml;
  }

  if (_.isUndefined(options.bodyFormatter) || _.isNull(options.bodyFormatter)) {
    this.bodyFormatter = defaultBodyFormatter;
  } else if (!_.isFunction(options.bodyFormatter)) {
    throw new TypeError('if provided, bodyFormatter must be a function');
  } else {
    this.bodyFormatter = options.bodyFormatter;
  }

  if (_.isUndefined(options.subjectFormatter) || _.isNull(options.subjectFormatter)) {
    this.subjectFormatter = defaultSubjectFormatter;
  } else if (!_.isFunction(options.subjectFormatter)) {
    throw new TypeError('if provided, subjectFormatter must be a function');
  } else {
    this.subjectFormatter = options.subjectFormatter;
  }

  this.__client = new postmark.Client(this.key);
}

PostmarkBunyan.prototype.write = function (record) {

  var body    = this.bodyFormatter(record);
  var subject = this.subjectFormatter(record);

  var message = {
    From:    this.fromEmail,
    To:      this.toEmail,
    Subject: subject
  };

  if (this.bodyIsHtml) { message.HtmlBody = body; }
  else { message.TextBody = body; }

  this.__client.sendEmail(message, function (error, result) {
    if (error) {
      console.error("Unable to send via postmark: " + error.message);
      return;
    }
  });
};

module.exports = PostmarkBunyan;