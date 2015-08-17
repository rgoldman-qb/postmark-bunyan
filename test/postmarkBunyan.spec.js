var expect = require('chai').expect;
var nock = require('nock');

var PostmarkBunyan = require('../index.js');

describe('postmark-bunyan tests', function(){
  it('should send to postmark when logged to bunyan', function(done){
    var logger = bunyan.createLogger({
      name: 'postmark-bunyan',
      streams: [{
        level: 'info',
        stream: new PostmarkBunyan(),
        type: 'raw'
      }]
    });
  });
});