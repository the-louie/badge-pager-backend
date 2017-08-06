/*jshint esversion: 6 */
const express = require('express');
const app = express();
const pg = require('pg');
const bodyParser = require('body-parser');
const crypto = require('crypto');

/**
 *
 *
 */

const generateId = (salt) => {
  let current_date = (new Date()).valueOf().toString();
  return crypto.createHash('sha1').update(current_date + salt).digest('hex');
}

 /**
  *


  */

app.set('port', (process.env.PORT || 5000));

const jsonParser = bodyParser.json()
app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function (request, response) {
  response.render("pages/index");
});

app.post('/send', jsonParser, (request, response) => {
  let messageId = generateId(request.body.nick + request.body.message);
  pg.connect(process.env.DATABASE_URL, (err, client, done) => {
    client.query('INSERT INTO badge_messages (messageid, sender, target, message) VALUES ($1,$2,$3,$4)', [], (err, result) => {
      if(err) return console.log("ERROR", err);
      if(result) return console.log("RESULT", result);
      response.send(messageId);
    });
  });
});

app.get('/response/:messageId', (request, response) => {
  pg.connect(process.env.DATABASE_URL, function (err, client, done) {
    client.query('SELECT * FROM badge_users', function (err, result) {
      done();
      if (err) {
        console.error(err);
        response.send("Error " + err);
      } else {
        if (result.rows.length() > 0) {
          response.render(
            "pages/response",
            {
              response: result.rows[0].response,
              messageId: request.params.messageId
            }
          );
        }
      }
    });
  });
});

app.get('/db', function (request, response) {
  pg.connect(process.env.DATABASE_URL, function (err, client, done) {
    client.query('SELECT * FROM badge_users', function (err, result) {
      done();
      if (err) {
        console.error(err);
        response.send("Error " + err);
      } else {
        response.send(JSON.stringify(result.rows, null, 2));
      }
    });
  });
});

app.listen(app.get('port'), function () {
  console.log('Node app is running on port', app.get('port'));
});