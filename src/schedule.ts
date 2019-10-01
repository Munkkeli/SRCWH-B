import * as crypto from 'crypto';
import * as request from 'request-promise';
import {
  format,
  parse,
  addDays,
  isAfter,
  isBefore,
  differenceInMinutes
} from 'date-fns';
import { PoolClient } from 'pg';

import * as User from './lib/user';
import * as Lesson from './lib/lesson';
import * as Slab from './lib/slab';
import * as CheckIn from './lib/checkin';

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
      .map(y => y.split('-')[0].trim());

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
      start: parse(
        `${format(timestamp, 'yyyy-MM-dd')} ${time[0]}`,
        'yyyy-MM-dd HH:mm',
        timestamp
      ),
      end: parse(
        `${format(timestamp, 'yyyy-MM-dd')} ${time[1]}`,
        'yyyy-MM-dd HH:mm',
        timestamp
      ),
      locationList,
      code,
      name,
      groupList,
      teacherList
    });
  });

  return lessonList as Lesson.Lesson[];
};

const checkIfLessonIsAvailable = (
  now: Date,
  lesson: Lesson.Lesson,
  last?: Lesson.Lesson
) => {
  const after = isAfter(now, lesson.start);
  const before = isBefore(now, lesson.end);
  const between = after && before;

  // If lesson is currently ongoing
  if (between) return true;

  // If there was a lesson before this lesson, make sure the 30 min rule does no collide with it
  let timeBetweenLessons = 30;
  if (last) {
    timeBetweenLessons = Math.min(
      30,
      differenceInMinutes(lesson.start, last.end)
    );
  }

  // If the lesson starts in less than 30 mins
  if (!after && differenceInMinutes(lesson.start, now) <= timeBetweenLessons) {
    return true;
  }

  return false;
};

const calculateDistanceBetweenPoints = (
  a: { x: number; y: number },
  b: { x: number; y: number }
) => {
  const radlat1 = (Math.PI * a.x) / 180;
  const radlat2 = (Math.PI * b.x) / 180;
  const theta = a.y - b.y;
  const radtheta = (Math.PI * theta) / 180;

  let dist =
    Math.sin(radlat1) * Math.sin(radlat2) +
    Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);

  if (dist > 1) {
    dist = 1;
  }

  dist = Math.acos(dist);
  dist = (dist * 180) / Math.PI;
  dist = dist * 60 * 1.1515;
  dist = dist * 1.609344;
  dist = dist * 1000;
  return dist;
};

export const get = async ({
  trx,
  user,
  today
}: {
  trx: PoolClient;
  user: User.User;
  today?: string;
}) => {
  if (!user.group) return [];

  const day = today || format(new Date(), 'yyyy-MM-dd');
  const list = await getListOfLessons(user.group, day);

  for (let lesson of list) {
    let id = await Lesson.exists({ trx, lesson });
    if (!id) {
      id = await Lesson.create({ trx, lesson });
    }

    lesson.id = id;

    lesson.attended = await CheckIn.exists({ trx, user, lesson: lesson.id });
  }

  return list;
};

export const attend = async ({
  trx,
  user,
  slabId,
  coordinates,
  confirmUpdate,
  confirmOverride,
  today
}: {
  trx: PoolClient;
  user: User.User;
  slabId: string;
  coordinates: { x: number; y: number };
  confirmUpdate: boolean;
  confirmOverride: boolean;
  today?: Date;
}) => {
  const slab = await Slab.get({ trx, slab: slabId });

  let state = {
    success: false,
    requiresUpdate: false,
    lesson: null,
    location: slab.location,
    existing: null,
    valid: {
      lesson: null,
      location: null,
      position: null
    }
  };

  // const now = new Date();
  const now = today || new Date();
  const lessonList = await get({ trx, user, today: format(now, 'yyyy-MM-dd') });

  // Search for an ongoing lesson
  let lastLesson = null;
  let validLesson: Lesson.Lesson | null = null;
  for (let lesson of lessonList) {
    const valid = checkIfLessonIsAvailable(now, lesson, lastLesson);
    if (valid) {
      validLesson = lesson;
      break;
    }
    lastLesson = lesson;
  }

  // No valid lesson found
  if (!validLesson) {
    state.valid.lesson = false;
    return state;
  }

  state.lesson = validLesson;
  state.valid.lesson = true;

  // Check if the lesson location is the same as the slab location
  state.valid.location =
    validLesson!.locationList.includes(slab.location) || confirmOverride;
  if (!state.valid.location) {
    return state;
  }

  // Make sure person is in range (400 meters or less)
  const distance = calculateDistanceBetweenPoints(
    coordinates,
    slab.coordinates
  );
  if (distance > 400) {
    state.valid.position = false;
    return state;
  }

  state.valid.position = true;

  /* Everything is good, save the attendance */

  // Check if attendance record for this lesson already exists, and ask if it should be updated
  const update = await CheckIn.exists({ trx, user, lesson: validLesson.id });
  state.requiresUpdate = !!update;
  state.existing = update || null;
  if (update && !confirmUpdate) {
    return state;
  }

  // Create or update the attendance record
  if (update) {
    await CheckIn.update({ trx, user, lesson: validLesson.id, slab });
  } else {
    await CheckIn.create({ trx, user, lesson: validLesson.id, slab });
  }

  state.success = true;

  // Return the good news!
  return state;
};
