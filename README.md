# postmark-bunyan
Send emails using Postmark from Bunyan stream.

Use NPM to install:

```
npm install postmark-bunyan
```

Example:

```javascript
var bunyan = require('bunyan);
var PostmarkBunyan = require('postmark-bunyan');

var logger = bunyan.createLogger({
  name:    'postmark-bunyan',
  streams: [{
    level:  'warn',
    stream: new PostmarkBunyan({
      serverApiToken: '<inert server api token here>',
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
}
```