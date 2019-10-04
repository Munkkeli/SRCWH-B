CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

create table "user"
(
  id bytea not null,
  "group" text
);

create unique index user_id_uindex
  on "user" (id);

alter table "user"
  add constraint user_pk
    primary key (id);

create table "token"
(
  value bytea not null,
  user_id bytea not null
    constraint token_user_id_fk
      references "user",
  expires_at timestamp default current_date + interval '6 month'
);

create unique index token_value_uindex
  on "token" (value);

alter table "token"
  add constraint token_pk
    primary key (value);

create table "lesson"
(
  id bytea not null,
  start timestamp not null,
  "end" timestamp not null,
  location text[] not null,
  address text,
  code text,
  name text,
  "group" text[],
  teacher text[] not null
);

create unique index lesson_id_uindex
  on "lesson" (id);

alter table "lesson"
  add constraint lesson_pk
    primary key (id);

create table "checkin"
(
  id serial not null,
  user_id bytea not null
    constraint checkin_user_id_fk
      references "user",
  lesson_id bytea not null
    constraint checkin_lesson_id_fk
      references "lesson",
  "group" text not null,
  location text not null,
  created_at timestamp default now() not null
);

create unique index checkin_id_uindex
  on "checkin" (id);

alter table "checkin"
  add constraint checkin_pk
    primary key (id);

create table "slab"
(
  id uuid default uuid_generate_v4() not null,
  coordinates point not null,
  location text not null
);

create unique index slab_id_uindex
  on "slab" (id);

alter table "slab"
  add constraint slab_pk
    primary key (id);

