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


