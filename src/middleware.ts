import { PoolClient } from 'pg';

import * as DB from './db';

import * as Token from './lib/token';
import * as User from './lib/user';

export const Request = (
  action: (trx: PoolClient, req, res, next) => Promise<any>
) => async (req, res, next) => {
  const trx = await DB.connect();

  let response: any = null;
  let failed = false;

  try {
    await trx.query('BEGIN');

    response = await action(trx, req, res, next);

    await trx.query('COMMIT');
  } catch (error) {
    await trx.query('ROLLBACK');
    console.error(error);
    failed = true;
  } finally {
    trx.release();

    if (failed) return res.sendStatus(500);
    if (!isNaN(Number(response))) return res.sendStatus(response);
    if (response) return res.send(response);

    return res.sendStatus(200);
  }
};

export const authenticate = async (req, res, next) => {
  const authorization = req.get('Authorization');
  if (!authorization) return next();
  if (!authorization.includes('Bearer ')) return next();

  const trx = await DB.connect();

  try {
    const token = authorization.split(' ')[1];
    const userId = await Token.validate({ trx, token });
    if (!userId) return next();

    const user = await User.get({ trx, hash: userId });
    if (!user) return next();

    req.user = user;
    req.token = token;
  } catch (error) {
    console.error(error);
  }

  return next();
};

export const protect = (req, res, next) => {
  if (req.user) return next();
  return res.sendStatus(403);
};
