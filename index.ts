import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';

import { config } from 'dotenv';

config();

import { Request } from './src/middleware';
import { login, check, logout } from './src/auth';

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
