import { PoolClient } from 'pg';

import * as DB from './db';

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
    if (response) return res.send(response);

    return res.sendStatus(200);
  }
};
