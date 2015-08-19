# postmark-bunyan
Send emails using Postmark from Bunyan stream.

Use NPM to install:

```
npm install postmark-bunyan
```

Example:

```javascript
var bunyan = require('bunyan');
var PostmarkBunyan = require('postmark-bunyan');

var logger = bunyan.createLogger({
  name:    'postmark-bunyan',
  streams: [{
    level:  'warn',
    stream: new PostmarkBunyan({
      serverApiToken: '<insert server api token here>',
      toEmail: ['developer@garbageemail.com'],
      fromEmail: 'noreply@garbageemail.com'
    }),
    type:   'raw'
  }]
});

logger.warn('Something happened');
```

The constructor takes the following options:
```javascript
{
  serverApiToken: String,     // Required: Server API token
  toEmail: Array of String,   // Required: Array email addresses
  fromEmail: String,          // Required: From email address
  bodyIsHtml: Boolean,        // Optional: Send body as html, probably want to supply a body formatter
  bodyFormatter: Function,    // Optional: Set your own body, receives log record argument
  subjectFormatter: Function, // Optional: Set your own subject, receives log record argument
  onSuccess: Function,        // Optional: Callback for successful sends, receives result
  onError: Function,          // Optional: Callback for send errors, receives error
  rateLimit: {                // Optional: Set a rate limit for outgoing emails
    value: Number,               // 100 in '100 emails per hour'
    interval: String             // 'hour' in '100 emails per hour'. Possible values: 'second', 'minute', 'hour', 'day'
  }
}
```
