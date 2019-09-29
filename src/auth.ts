import * as request from 'request-promise';
import { PoolClient } from 'pg';

import * as User from './lib/user';
import * as Token from './lib/token';

const authenticateWithMetropolia = async (
  username: string,
  password: string
) => {
  const jar = request.jar();

  const options = {
    method: 'POST',
    url: 'https://amme.metropolia.fi/metka/login.jsf',
    followAllRedirects: true,
    jar,
    form: {
      j_username: username,
      j_password: password,
      'login_inc:_idJsp18:_idJsp23': 'Kirjaudu',
      'login_inc:_idJsp18_SUBMIT': 1
    }
  };

  // Load page first so we get a session cookie
  await request({ ...options, method: 'GET', form: null });

  // Authenticate the session cookie
  const body = await request(options);

  if (body.includes('Bad credentials')) return null;

  // Parse the session ID from the cookie
  const cookieString = jar.getCookieString('https://amme.metropolia.fi/metka');
  const session = cookieString.split('=')[1];

  return session;
};

const getMetropoliaUserInfo = async (session: string) => {
  const jar = request.jar();

  jar.setCookie(
    `JSESSIONID=${session}; path=/metka; domain=amme.metropolia.fi; HttpOnly;`,
    'https://amme.metropolia.fi/metka'
  );

  const options = {
    method: 'POST',
    url: 'https://amme.metropolia.fi/metka/jsp/ui/start.jsf',
    jar,
    form: {
      _idJsp11_SUBMIT: 1,
      '_idJsp11:_idcl': '_idJsp11:_idJsp12'
    }
  };

  // Load the "Omat tiedot" page
  const body = await request(options);

  // Parse user information
  try {
    const id = body.match(/(?<=metropolia\.student: <\/td><td>).*?(?= )/gm)[0];
    const firstName = body.match(/(?<=Sukunimi:<\/td><td>).*?(?=<\/td>)/gm)[0];
    const lastName = body.match(
      /(?<=Kutsumanimi:<\/td><td>).*?(?=<\/td>)/gm
    )[0];
    const initialGroupList = body
      .match(/(?<=Saapumisryhmä:<\/td><td>).*?(?=<\/td>)/gm)[0]
      .split('<br>');
    const groupList = body
      .match(/(?<=Hallinnollinen ryhmä:<\/td><td>).*?(?=<\/td>)/gm)[0]
      .split('<br>');

    let finalGroupList = groupList;
    if (!finalGroupList || !finalGroupList.length) {
      finalGroupList = initialGroupList;
    }
    if (!finalGroupList || !finalGroupList.length) {
      finalGroupList = [];
    }

    return {
      id,
      firstName,
      lastName,
      groupList: finalGroupList
    };
  } catch (error) {
    console.error('Could not parse user info', error);
    return null;
  }
};

export const login = async ({
  trx,
  username,
  password
}: {
  trx: PoolClient;
  username: string;
  password: string;
}) => {
  // Login with Metropolia
  const session = await authenticateWithMetropolia(username, password);
  if (!session) return 403;

  // Load user info from Metropolia
  const info = await getMetropoliaUserInfo(session);
  if (!info) return 403;

  const hash = User.hashUserId(info.id);

  // Check if user is already in DB
  let user = await User.get({ trx, hash });

  // First time user, create DB record
  if (!user) {
    user = await User.create({
      trx,
      id: info.id,
      group: info.groupList.length > 1 ? null : info.groupList[0]
    });
  }

  // Create access token for this session
  const token = await Token.create({ trx, user: user.hash });

  return {
    user: { ...info, hash: user.hash },
    token
  };
};

export const check = async ({
  trx,
  token
}: {
  trx: PoolClient;
  token: string;
}) => {
  const user = await Token.validate({ trx, token });
  if (user) return 200;
  return 403;
};

export const logout = async ({
  trx,
  token
}: {
  trx: PoolClient;
  token: string;
}) => {
  await Token.remove({ trx, token });
};

export const update = async ({
  trx,
  user,
  group
}: {
  trx: PoolClient;
  user: User.User;
  group: string;
}) => {
  await User.update({
    trx,
    hash: user.hash,
    group
  });
};
