var _ = require('lodash');

var express = require('express');

// Require middleware-modules.
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var parseMagnetURI = require('magnet-uri');

// Initialize server.
var server = express();

// Get redis client.
var redis = require('./redis');

// Use consolidate for templating, since Hogan.js doesn't work well with Express
// out of the box.
var cons = require('consolidate');
server.engine('html', cons.hogan);
server.set('view engine', 'html');
server.set('views', __dirname + '/views');

// Serve static files in /static.
server.use(express.static(__dirname + '/static'));

// Parse form data. TODO CSRF
server.use(bodyParser.urlencoded());

// Serve index page.
server.get('/', function (req, res) {
  res.render('index', {
    "header": "Colors",
    "items": [
        {"name": "red", "first": true, "url": "#Red"},
        {"name": "green", "link": true, "url": "#Green"},
        {"name": "blue", "link": true, "url": "#Blue"}
    ],
    "empty": false
  });
});

// Store a new Magnet URI.
server.post('/submit', function (req, res) {
  // TODO Display flash messages!
  var magnetURI = req.body['magnet-uri'];
  var magnet = parseMagnetURI(magnetURI);
  console.log(magnet);
  // Empty parsed object -> invalid magnet link!
  if (_.isEmpty(magnet)) {
    return res.redirect('/');
  }
  // Don't insert duplicates!
  redis.exists('magnet:' + magnet.infoHash, function (err, exists) {
    if (exists) {
      res.redirect('/');
    } else {
      // Everything is ok, insert Magnet in database.
      var createdAt = new Date().getTime();
      redis.hmset('magnet:' + magnet.infoHash, {
        magnetURI: magnetURI,
        parsedMagnetURI: JSON.stringify(magnet),
        createdAt: createdAt,
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
      }, function (err) {
        redis.sadd('magnets:all', magnet.infoHash);
        redis.zadd('magnets:createdAt', createdAt, magnet.infoHash);
        redis.sadd('magnets:ip:' + ip, magnet.infoHash);
        redis.rpush('magnets:crawl', magnet.infoHash);
        // Insertion complete.
        res.redirect('/');
      });
    }
  });
});

var port = process.env.PORT || 3141;
server.listen(port, function () {
  console.info('Express server listening on port ' + port);
});
