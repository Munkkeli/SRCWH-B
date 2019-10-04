import * as crypto from 'crypto';
import { PoolClient } from 'pg';

export interface Lesson {
  id?: string;
  start: Date;
  end: Date;
  locationList: string[];
  address: string;
  code: string;
  name: string;
  groupList: string[];
  teacherList: string[];
  attended?: string;
}

export const hashLessonId = (lesson: Lesson) => {
  const id = `${lesson.start}-${lesson.locationList.join(',')}-${
    lesson.name
  }-${lesson.groupList.join(',')}`;

  return crypto
    .createHash('sha256')
    .update(`${id}`)
    .digest('hex');
};

export const create = async ({
  trx,
  lesson
}: {
  trx: PoolClient;
  lesson: Lesson;
}) => {
  const hash = hashLessonId(lesson);

  const { rows } = await trx.query(
    'INSERT INTO "lesson" (id, start, "end", location, address, code, name, "group", teacher) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
    [
      hash,
      lesson.start,
      lesson.end,
      lesson.locationList,
      lesson.address,
      lesson.code,
      lesson.name,
      lesson.groupList,
      lesson.teacherList
    ]
  );

  if (!rows.length) throw new Error('Could not create lesson');

  return rows[0].id.toString();
};

export const exists = async ({
  trx,
  lesson
}: {
  trx: PoolClient;
  lesson: Lesson;
}) => {
  const hash = hashLessonId(lesson);
  const { rows } = await trx.query(
    'SELECT COUNT(*) FROM "lesson" WHERE id = $1',
    [hash]
  );

  if (!rows.length) throw new Error('Failed to count lessons');

  return rows[0].count > 0 ? hash : null;
};
