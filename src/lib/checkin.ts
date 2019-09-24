import * as crypto from 'crypto';
import { PoolClient } from 'pg';
import { User } from './user';
import { Slab } from './slab';

export interface CheckIn {
  id: string;
  userId: string;
  lessonId: string;
  time: Date;
  location: string[];
  group: string;
  createdAt: Date;
}

export const get = async ({
  trx,
  user,
  lesson
}: {
  trx: PoolClient;
  user: User;
  lesson: string;
}) => {
  const { rows } = await trx.query(
    'SELECT id, user_id, lesson_id, group, location, created_at FROM "checkin" WHERE user_id = $1 AND lesson_id = $2',
    [user.hash, lesson]
  );

  if (!rows.length) throw new Error('Failed to find checkin');

  return {
    id: rows[0].id.toString(),
    userId: rows[0].user_id.toString(),
    lessonId: rows[0].lesson_id.toString(),
    group: rows[0].group,
    location: rows[0].location,
    createdAt: rows[0].created_at
  } as CheckIn;
};

export const create = async ({
  trx,
  user,
  lesson,
  slab
}: {
  trx: PoolClient;
  user: User;
  lesson: string;
  slab: Slab;
}) => {
  const { rows } = await trx.query(
    'INSERT INTO "checkin" (user_id, lesson_id, "group", location) VALUES ($1, $2, $3, $4) RETURNING id',
    [user.hash, lesson, user.group, slab.location]
  );

  if (!rows.length) throw new Error('Could not create checkin');

  return rows[0].id.toString();
};

export const update = async ({
  trx,
  user,
  lesson,
  slab
}: {
  trx: PoolClient;
  user: User;
  lesson: string;
  slab: Slab;
}) => {
  const { rowCount } = await trx.query(
    'UPDATE "checkin" SET "group" = $1, location = $2 WHERE user_id = $3 AND lesson_id = $4',
    [user.group, slab.location, user.hash, lesson]
  );

  if (!rowCount) throw new Error('Could not update checkin');
};

export const exists = async ({
  trx,
  user,
  lesson
}: {
  trx: PoolClient;
  user: User;
  lesson: string;
}) => {
  const { rows } = await trx.query(
    'SELECT location FROM "checkin" WHERE user_id = $1 AND lesson_id = $2',
    [user.hash, lesson]
  );

  if (!rows.length) return null;

  return rows[0].location;
};
