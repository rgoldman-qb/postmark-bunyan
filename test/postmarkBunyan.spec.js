var expect  = require('chai').expect;
var nock    = require('nock');
var bunyan  = require('bunyan');
var mockery = require('mockery');

var exampleInfoLog = {
  name:     'postmark-bunyan',
  hostname: 'eva',
  pid:      3109,
  level:    30,
  msg:      'Something happened',
  time:     'Mon Aug 17 2015 12:48:05 GMT-0400 (EDT)',
  v:        0
};

describe('postmark-bunyan integration tests', function () {
  var PostmarkBunyan = require('../index.js');

  afterEach(function () {
    nock.cleanAll();
  });

  it('should send to postmark API when logged to bunyan', function (done) {
    var emailReceived = false;

    nock('https://api.postmarkapp.com:443')
      .post('/email', function (body) {
        expect(body.From).to.eql('noreply@garbageemail.com');
        expect(body.To).to.eql('developer@garbageemail.com');
        expect(body.Subject).to.eql('INFO from postmark-bunyan: Something ha ...');

        emailReceived = true;
        return true;
      })
      .reply(200,
      {
        "To":          "developer@garbageemail.com",
        "SubmittedAt": "2015-08-17T12:14:49.8408469-04:00",
        "MessageID":   "37073f8a-7a89-4892-b332-48af5671c964",
        "ErrorCode":   0,
        "Message":     "OK"
      },
      {
        'cache-control':  'private',
        'content-type':   'application/json; charset=utf-8',
        server:           'unicorns-double-rainbow',
        'x-powered-by':   'ASP.NET',
        date:             'Mon, 17 Aug 2015 16:14:49 GMT',
        connection:       'close',
        'content-length': '169'
      });

    var logger = bunyan.createLogger({
      name:    'postmark-bunyan',
      streams: [{
        level:  'info',
        stream: new PostmarkBunyan({
          serverApiToken: 'not-a-real-server-api-token',
          toEmail:        ['developer@garbageemail.com'],
          fromEmail:      'noreply@garbageemail.com'
        }),
        type:   'raw'
      }]
    });

    setTimeout(function () {
      expect(emailReceived).to.be.truthy;
      done();
    }, 50);

    logger.info('Something happened');
  });

  it('should use onSuccess callback if provided', function (done) {

    var customOnSuccess = function (result) {
      expect(result.Message).to.eql('OK');
      done()
    };

    nock('https://api.postmarkapp.com:443')
      .post('/email', function (body) {
        expect(body.From).to.eql('noreply@garbageemail.com');
        expect(body.To).to.eql('developer@garbageemail.com');
        expect(body.Subject).to.eql('INFO from postmark-bunyan: Something ha ...');

        return true;
      })
      .reply(200,
      {
        "To":          "developer@garbageemail.com",
        "SubmittedAt": "2015-08-17T12:14:49.8408469-04:00",
        "MessageID":   "37073f8a-7a89-4892-b332-48af5671c964",
        "ErrorCode":   0,
        "Message":     "OK"
      },
      {
        'cache-control':  'private',
        'content-type':   'application/json; charset=utf-8',
        server:           'unicorns-double-rainbow',
        'x-powered-by':   'ASP.NET',
        date:             'Mon, 17 Aug 2015 16:14:49 GMT',
        connection:       'close',
        'content-length': '169'
      });

    var logger = bunyan.createLogger({
      name:    'postmark-bunyan',
      streams: [{
        level:  'info',
        stream: new PostmarkBunyan({
          serverApiToken: 'not-a-real-server-api-token',
          toEmail:        ['developer@garbageemail.com'],
          fromEmail:      'noreply@garbageemail.com',
          onSuccess:      customOnSuccess
        }),
        type:   'raw'
      }]
    });

    logger.info('Something happened');
  });


});

describe('rate limit tests', function () {

  var postmarkMessage = null;
  //var postmarkCb = null;
  var testCb = null;

  before(function () {
    mockery.enable({
      useCleanCache:      true,
      warnOnReplace:      false,
      warnOnUnregistered: false
    });

    var postmarkMock = {
      Client: function () {
        this.sendEmail = function (message, cb) {
          //console.log('Client');
          postmarkMessage = message;
          cb();
          testCb(message);
        };
      }
    };

    mockery.registerMock('postmark', postmarkMock);
  });

  beforeEach(function () {
    postmarkMessage = null;
    //postmarkCb = null;
  });

  after(function () {
    mockery.disable();
  });

  it('should use rate limit if provided', function (done) {
    this.timeout(5000);

    var PostmarkBunyan = require('../index.js');
    var testCbFired    = false;

    var logger = bunyan.createLogger({
      name:    'postmark-bunyan',
      streams: [{
        level:  'info',
        stream: new PostmarkBunyan({
          serverApiToken: 'not-a-real-server-api-token',
          toEmail:        ['developer@garbageemail.com'],
          fromEmail:      'noreply@garbageemail.com',
          rateLimit:      {
            interval: 'second',
            value:    1
          }
        }),
        type:   'raw'
      }]
    });

    testCb = function (message) {
      if (!testCbFired) {
        expect(message.TextBody).to.contain('Something happened');
        testCbFired = true;
      } else {
        expect(message.TextBody).to.contain('Something else happened');
        expect(message.TextBody).to.contain('Something more bad');
        expect(message.TextBody).to.contain('Whhhyyyyy');
        done();
      }
    };

    logger.info('Something happened');
    logger.info('Something else happened');
    logger.info('Something more bad');
    logger.info('Whhhyyyyy');
  });
});

describe('postmark-bunyan message generation tests', function () {
  var PostmarkBunyan = require('../index.js');

  /**
   * Use private method to test the rest of message generation, API integration demonstrated in first test group
   */
  it('should generate text message if bodyIsHtml is not set', function () {
    var postmarkBunyan = new PostmarkBunyan({
      serverApiToken: 'not-a-real-server-api-token',
      toEmail:        ['developer@garbageemail.com'],
      fromEmail:      'noreply@garbageemail.com'
    });

    var message = postmarkBunyan.__generateMessage(exampleInfoLog);

    expect(message.TextBody).to.be.defined;
    expect(message.HtmlBody).to.not.be.defined;
  });

  it('should generate html message if bodyIsHtml is set', function () {
    var postmarkBunyan = new PostmarkBunyan({
      serverApiToken: 'not-a-real-server-api-token',
      toEmail:        ['developer@garbageemail.com'],
      fromEmail:      'noreply@garbageemail.com',
      bodyIsHtml:     true
    });

    var message = postmarkBunyan.__generateMessage(exampleInfoLog);

    expect(message.TextBody).to.not.be.defined;
    expect(message.HtmlBody).to.be.defined;
  });

  it('should send to multiple emails if provided', function () {
    var postmarkBunyan = new PostmarkBunyan({
      serverApiToken: 'not-a-real-server-api-token',
      toEmail:        ['developer@garbageemail.com', 'developer2@garbageemail.com'],
      fromEmail:      'noreply@garbageemail.com',
      bodyIsHtml:     true
    });

    var message = postmarkBunyan.__generateMessage(exampleInfoLog);

    expect(message.To).to.eql('developer@garbageemail.com,developer2@garbageemail.com')
  });

  it('should use custom bodyFormatter if provided', function () {
    var customBodyFormatter = function (record) {
      return 'Nothing';
    };

    var postmarkBunyan = new PostmarkBunyan({
      serverApiToken: 'not-a-real-server-api-token',
      toEmail:        ['developer@garbageemail.com', 'developer2@garbageemail.com'],
      fromEmail:      'noreply@garbageemail.com',
      bodyFormatter:  customBodyFormatter
    });

    var message = postmarkBunyan.__generateMessage(exampleInfoLog);

    expect(message.TextBody).to.eql('Nothing');
  });

  it('should use custom subjectFormatter if provided', function () {
    var customSubjectFormatter = function (record) {
      return 'Nothing';
    };

    var postmarkBunyan = new PostmarkBunyan({
      serverApiToken:   'not-a-real-server-api-token',
      toEmail:          ['developer@garbageemail.com', 'developer2@garbageemail.com'],
      fromEmail:        'noreply@garbageemail.com',
      subjectFormatter: customSubjectFormatter
    });

    var message = postmarkBunyan.__generateMessage(exampleInfoLog);

    expect(message.Subject).to.eql('Nothing');
  });
});