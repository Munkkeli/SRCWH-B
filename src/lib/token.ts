import * as crypto from 'crypto';
import { PoolClient } from 'pg';

const generateAccessToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

export const validate = async ({
  trx,
  token
}: {
  trx: PoolClient;
  token: string;
}) => {
  const { rows } = await trx.query(
    'SELECT user_id FROM "token" WHERE value = $1 AND expires_at > now()',
    [token]
  );

  if (!rows.length) return false;

  return rows[0].user_id.toString();
};

export const create = async ({
  trx,
  user
}: {
  trx: PoolClient;
  user: string;
}) => {
  const token = generateAccessToken();

  const { rows } = await trx.query(
    'INSERT INTO "token" (value, user_id, expires_at) VALUES ($1, $2, $3) RETURNING value',
    [token, user, new Date(Date.now() + 20000)]
  );

  if (!rows.length) throw new Error('Could not create token');

  return rows[0].value.toString();
};

export const remove = async ({
  trx,
  token
}: {
  trx: PoolClient;
  token: string;
}) => {
  await trx.query('DELETE FROM "token" WHERE value = $1', [token]);
};
