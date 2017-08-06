/*jshint esversion: 6 */
const express = require('express');
const app = express();
const pg = require('pg');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const mqtt = require('mqtt');

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

const jsonParser = bodyParser.json();
const urlEncoder = bodyParser.urlencoded();
app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function (request, response) {
  if (mqttClient.connected) {
    response.render("pages/index");
  } else {
    response.send("Please come back later, a minute or two");
    response.end();
  }
});

const getUserFromNick = (nick) => new Promise((resolve, reject) => {
  pg.connect(process.env.DATABASE_URL, (err, client, done) => {
    client.query('SELECT * FROM badge_users WHERE nick = $1', [nick], (err, result) => {
      if (err) { reject(); return; }
      else if (result.rowCount === 0) { reject(); return; }
      else { resolve(result.rows[0]); }
    });
  });
});

// const mqttClient  = mqtt.connect('mqtt://test.mosquitto.org');
const mqttClient  = mqtt.connect('wxs://test.mosquitto.org');

mqttClient.on('connect', function () {
  mqttClient.subscribe('sha2017pager/swe/replies');
  console.log("MQTT connected");
});

mqttClient.on('message', function (topic, message) {
  // message is Buffer
  // {"id": "680946cf38867399a0c38c5e39cc793af574b3f3", "text": "ack"}
  try {
    data = JSON.parse(message);
  } catch (e) {
    console.log("Invalid JSON in response", message);
    return;
  }

  pg.connect(process.env.DATABASE_URL, function (err, client, done) {
    client.query('INSERT INTO badge_responses (messageid, response) VALUES ($1, $2)', [data.id, data.text], function (err, result) {
      if (err) { console.error(err); }
      done();
    });
  });

  console.log(message.toString());
});

function sendHandler(request, response) {
  let targetNick = request.body.target;
  let senderNick = request.body.sender;
  let message = request.body.message;
  let messageId = generateId(targetNick + message + senderNick);

  pg.connect(process.env.DATABASE_URL, (err, client, done) => {
    client.query('SELECT * FROM badge_users WHERE nick = $1', [senderNick], (err, result) => {
      done();
      if (err) { return; }
      else if (result.rowCount === 0) { return; }
      else {
        sender = result.rows[0];

        pg.connect(process.env.DATABASE_URL, (err, client, done) => {
          client.query('SELECT * FROM badge_users WHERE nick = $1', [targetNick], (err, result) => {
            done();
            if (err) { return; }
            else if (result.rowCount === 0) { return; }
            else {
              target = result.rows[0];

              pg.connect(process.env.DATABASE_URL, (err, client, done) => {
                client.query(
                    'INSERT INTO badge_messages (messageid, sender, target, message) VALUES ($1,$2,$3,$4)',
                    [messageId, sender.id, target.id, message],
                    (err, result) => {
                      if(err) {
                        resonse.send("ERR");
                        return console.log("ERROR", err);
                      }
                      const mqttTarget = `sha2017pager/swe/${target.badgeid}`;
                      console.log(`Sending '${message}' to '${mqttTarget}'.`);
                      const payload = JSON.stringify({sender: sender.nick, text: message, id: messageId});
                      mqttClient.publish(mqttTarget, payload, null, console.log);
                      response.send(messageId);
                    });
              });
            }
          });
        });
      }
    });
  });
}

app.post('/send', urlEncoder, sendHandler);

app.get('/response/:messageId', (request, response) => {
  response.render(
    "pages/response",
    {
      messageId: request.params.messageId
    }
  );
});

app.post('/response/:messageId', (request, response) => {
  pg.connect(process.env.DATABASE_URL, function (err, client, done) {
    client.query('select message, response from badge_responses r left join badge_messages m on m.messageid=r.messageid where r.messageid=$1', [request.params.messageId], function (err, result) {
      done();
      if (err) {
        console.error(err);
        response.end();
      } else {
        if (result.rowCount > 0) {
          response.send(result.rows[0]);
        } else {
          response.end();
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

app.get('/register', (request, response) => {
  response.render("pages/register");
});

app.get('/listusers', (request, response) => {
  pg.connect(process.env.DATABASE_URL, function (err, client, done) {
    client.query("SELECT nick FROM badge_users where badgeid != ''", function (err, result) {
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

app.post('/register', urlEncoder, (request, response) => {
  console.log("new register", JSON.stringify(request.body));
  if (!request.body.nick || !request.body.badgeid) {
    response.write("FAIL");
    return;
  }

  // verify mac
  mac = badgeid.split(':');
  if (mac.length !== 6) {
    response.write("FAIL");
    return;
  }
  for (let submac of mac) {
    res=submac.match(/[0-9a-f]{2}/);
    if (res === null) {
      response.write("FAIL");
      return;
    }
  }

  const passhash = "";
  const ip = request.connection.remoteAddress;

  pg.connect(process.env.DATABASE_URL, function (err, client, done) {
    client.query('INSERT INTO badge_users (nick, password, badgeid, ip) VALUES ($1,$2,$3, $4)', [request.body.nick, passhash, request.body.badgeid, ip], function (err, result) {
      done();
      if (err) {
        console.error(err);
        response.send("Error " + err);
      } else {
        response.send("OK");
      }
    });
  });
});

app.listen(app.get('port'), function () {
  console.log('Node app is running on port', app.get('port'));
});