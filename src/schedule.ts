import * as crypto from 'crypto';
import * as request from 'request-promise';
import { compareAsc, format, parse, addDays } from 'date-fns';
import { PoolClient } from 'pg';

import * as User from './lib/user';
import * as Token from './lib/token';
import * as Lesson from './lib/lesson';

const hashLessonId = (id: string) => {
  return crypto
    .createHash('sha256')
    .update(`${id}`)
    .digest('hex');
};

const getListOfLessons = async (group: string, dayString: string) => {
  const jar = request.jar();

  // Add the group schedule to the schedule basket
  await request({
    method: 'GET',
    url: `https://lukkarit.metropolia.fi/paivitaKori.php?toiminto=addGroup&code=${group}`,
    jar
  });

  // Load the calendar data
  const body = await request({
    method: 'GET',
    url: `https://lukkarit.metropolia.fi/tulostus.php?date=${dayString}`,
    jar
  });

  // Cut unused parts of the page
  let dayList = body
    .split('<td class="cl-col nd">')
    .slice(1)
    .map(x => x.split('</td>')[0]);

  // Find day rows from calendar
  dayList = dayList.map((x, i) => ({
    day: x.match(/(?<=clDay=").*?(?=\.">)/gm)[0],
    index: i,
    lessonList: x.split('<div class="cl-event').slice(1)
  }));

  // Find the first day (This is needed to handle the year correctly)
  let firstDay = parse(
    `${dayList[0].day}.${format(new Date(), 'yyyy')}`,
    'dd.MM.yyyy',
    new Date()
  );

  // Find the date that was requested
  const requestedDay = dayList.find(
    x =>
      x.day ===
      dayString
        .split('-')
        .slice(1)
        .reverse()
        .join('.')
  );

  // Calendar empty on that day
  if (!requestedDay) return [] as Lesson.Lesson[];

  // Parse all course data from one day
  const lessonList = [];
  requestedDay.lessonList.map(x => {
    const time = x
      .match(/(?<=<dl class="cl-event-dl">).*?(?=<\/dt>)/gms)[0]
      .split('<dt>')[1]
      .split('-')
      .map(y => y.trim());
    const locationList = x
      .match(/(?<=<b>).*?(?=<\/b>)/gm)[0]
      .split(';')
      .map(y => y.trim());

    const infoLine = x.match(/(?<=<br\/>).*?(?=<br\/>)/gms);

    const code = infoLine[1].replace('<p>', '');
    const name = infoLine[0].replace(code, '').trim();
    const groupList = infoLine[2].split(',').map(y => y.trim());
    const teacherList = infoLine[3]
      .replace('Henkilö(t):', '')
      .split(',')
      .map(y => y.trim());

    let timestamp = addDays(firstDay, requestedDay.index);

    lessonList.push({
      start: `${format(timestamp, 'yyyy-MM-dd')} ${time[0]}`,
      end: `${format(timestamp, 'yyyy-MM-dd')} ${time[1]}`,
      locationList,
      code,
      name,
      groupList,
      teacherList
    });
  });

  return lessonList as Lesson.Lesson[];
};

export const get = async ({
  trx,
  user,
  day
}: {
  trx: PoolClient;
  user: User.User;
  day: string;
}) => {
  const list = await getListOfLessons(user.group, '2019-09-24');

  for (let lesson of list) {
    let id = await Lesson.exists({ trx, lesson });
    if (!id) {
      id = await Lesson.create({ trx, lesson });
    }

    lesson.id = id;
  }

  return list;
};

export const attend = async (user: User.User, lesson: Lesson.Lesson) => {
  // TODO: make this
};
