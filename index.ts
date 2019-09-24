import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import { parse } from 'date-fns';

import { config } from 'dotenv';

config();

import { Request } from './src/middleware';
import { login, check, logout } from './src/auth';
import * as Schedule from './src/schedule';

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.get(
  '/ping',
  Request(async (trx, req, res) => {
    return { pong: true, time: new Date().toISOString() };
  })
);

app.post(
  '/login',
  Request(async (trx, req, res) => {
    return await login({
      trx,
      username: req.body.username,
      password: req.body.password
    });
  })
);

app.post(
  '/check',
  Request(async (trx, req, res) => {
    return await check({
      trx,
      token: req.body.token,
      user: req.body.user
    });
  })
);

app.post(
  '/logout',
  Request(async (trx, req, res) => {
    return await logout({
      trx,
      token: req.body.token
    });
  })
);

app.get(
  '/schedule',
  Request(async (trx, req, res) => {
    return await Schedule.get({
      trx,
      user: {
        hash:
          'f7a5693b754bcc9040a0f10dc5e103eb6ff0693dcd6624dd10fe152d21cb5217',
        group: 'ICT17-M'
      },
      today: '2019-09-17' // TODO: remove debug override
    });
  })
);

app.post(
  '/attend',
  Request(async (trx, req, res) => {
    return await Schedule.attend({
      trx,
      user: {
        hash:
          'f7a5693b754bcc9040a0f10dc5e103eb6ff0693dcd6624dd10fe152d21cb5217',
        group: 'ICT17-M'
      },
      slabId: req.body.slab,
      coordinates: req.body.coordinates,
      confirmUpdate: req.body.confirmUpdate === true,
      today: parse('2019-09-17 14:00', 'yyyy-MM-dd HH:mm', new Date()) // TODO: remove debug override
    });
  })
);

let server;

if (process.env.SSL == 'false') {
  server = http.createServer(app);
} else {
  server = https.createServer(
    {
      key: fs.readFileSync(process.env.SSL_PRIVATE_KEY, 'utf8'),
      cert: fs.readFileSync(process.env.SSL_CERTIFICATE, 'utf8')
    },
    app
  );
}

server.listen(process.env.PORT, () => {
  console.log(
    `Listening on port ${process.env.PORT} for ${
      process.env.SSL == 'false' ? 'HTTP' : 'HTTPS'
    } traffic...`
  );
});
