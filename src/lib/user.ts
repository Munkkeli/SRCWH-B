import * as crypto from 'crypto';
import { PoolClient } from 'pg';

export const hashUserId = (id: number) => {
  return crypto
    .createHash('sha256')
    .update(`${id}`)
    .digest('hex');
};

export interface User {
  hash: string;
  group: string;
}

export const get = async ({ trx, hash }: { trx: PoolClient; hash: string }) => {
  const { rows } = await trx.query(
    'SELECT id, "group" FROM "user" WHERE id = $1',
    [hash]
  );

  if (!rows.length) return null;

  return {
    hash: rows[0].id.toString(),
    group: rows[0].group
  } as User;
};

export const create = async ({
  trx,
  id,
  group
}: {
  trx: PoolClient;
  id: number;
  group?: string;
}) => {
  const hash = hashUserId(id);

  const { rows } = await trx.query(
    'INSERT INTO "user" (id, "group") VALUES ($1, $2) RETURNING id',
    [hash, group]
  );

  if (!rows.length) throw new Error('Could not create user');

  return { hash: rows[0].id.toString(), group } as User;
};

export const update = async ({
  trx,
  hash,
  group
}: {
  trx: PoolClient;
  hash: string;
  group: string;
}) => {
  const { rowCount } = await trx.query(
    'UPDATE "user" SET "group" = $2 WHERE id = $1',
    [hash, group]
  );

  if (!rowCount) throw new Error('Could not update user');

  return { hash: hash.toString(), group } as User;
};
