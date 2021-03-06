import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as express from 'express';
import * as helmet from 'helmet';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as morgan from 'morgan';
import { parse, format } from 'date-fns';

import { config } from 'dotenv';

config();

import { Request, authenticate, protect } from './src/middleware';
import { login, check, logout, update } from './src/auth';
import * as Schedule from './src/schedule';

const app = express();

app.use(cors());
app.use(helmet());
app.use(bodyParser.json());

app.use(morgan('tiny'));

app.use(authenticate);

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
      token: req.token
    });
  })
);

app.post(
  '/logout',
  protect,
  Request(async (trx, req, res) => {
    return await logout({
      trx,
      token: req.token
    });
  })
);

app.post(
  '/update',
  protect,
  Request(async (trx, req, res) => {
    return await update({
      trx,
      user: req.user,
      group: req.body.group
    });
  })
);

app.get(
  '/schedule',
  protect,
  Request(async (trx, req, res) => {
    return await Schedule.get({
      trx,
      user: req.user
      // today: '2019-09-17' // TODO: remove debug override
    });
  })
);

app.post(
  '/attend',
  protect,
  Request(async (trx, req, res) => {
    return await Schedule.attend({
      trx,
      user: req.user,
      slabId: req.body.slab,
      coordinates: req.body.coordinates,
      confirmUpdate: req.body.confirmUpdate === true,
      confirmOverride: req.body.confirmOverride === true
      /*
      today: parse(
        `2019-09-17 ${req.body.debugTime || format(new Date(), 'HH:mm')}`,
        'yyyy-MM-dd HH:mm',
        new Date()
      ) // TODO: remove debug override
      */
    });
  })
);

// Used to automatically open the app from NFC read
let assetLinks = JSON.parse(fs.readFileSync('assetlinks.json').toString());
assetLinks[0].target.sha256_cert_fingerprints.push(process.env.APP_FINGERPRINT);
app.get('/.well-known/assetlinks.json', (req, res) => res.send(assetLinks));

let server;

if (process.env.SSL == 'false') {
  server = http.createServer(app);
} else {
  server = https.createServer(
    {
      key: fs.readFileSync(process.env.SSL_PRIVATE_KEY, 'utf8'),
      cert: fs.readFileSync(process.env.SSL_CERTIFICATE, 'utf8'),
      ca: fs.readFileSync(process.env.SSL_CA_BUNDLE, 'utf8')
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
