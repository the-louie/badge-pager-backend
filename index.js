var express = require('express');
var app = express();
var pg = require('pg');

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

app.get('/', function (request, response) {
  response.write("hej");
  response.end();
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