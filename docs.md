## Authentication

Authentication with the API is done by setting the `Authorization` header on a request to `Bearer <TOKEN>`.
The token used is the access token from calling `/login`.

## Endpoints

### `/ping`

Check if server is running. Also returns the current server time.

Request: `GET`

Response:

```json
{
  "pong": true,
  "time": "2019-09-25T10:01:24.668Z"
}
```

---

### `/login`

Login with Metropolia account. Returns account info and access token.

**NOTE:** If more than one group is returned, no default group is saved, and user must be updated with a default group.

Request: `POST`

```json
{
  "username": "metropolia_man",
  "password": "secret_password"
}
```

Response:

```json
{
  "user": {
    "id": "<METROPOLIA ID>",
    "firstName": "Metropolia",
    "lastName": "Man",
    "groupList": ["GROUP-1", "GROUP-2"],
    "hash": "<USER ID HASH>"
  },
  "token": "<ACCESS TOKEN>"
}
```

---

### `/check`

Check if access token is still valid.

Request: `POST`

```json
{}
```

Response:

```json
{
  "valid": true
}
```

---

### `/logout`

Log user out and invalidate token.

Request: `POST`

```json
{}
```

Response: `200`

---

### `/schedule`

List all lessons happening today, and the status of attendance.

**NOTE:** The `attended` value will be `null` if the user has not cheked in yet, and the location code of the check in location if he has.

Request: `GET`

Response:

```json
[
  {
    "start": "2019-09-17T06:00:00.000Z",
    "end": "2019-09-17T12:00:00.000Z",
    "locationList": ["CLASSROOM-1"],
    "code": "BLA-1234",
    "name": "Interesting Lesson 1",
    "groupList": ["GROUP-1"],
    "teacherList": ["Mr. Teacher"],
    "id": "<LESSON ID>",
    "attended": null
  },
  {
    "start": "2019-09-17T12:00:00.000Z",
    "end": "2019-09-17T15:00:00.000Z",
    "locationList": ["CLASSROOM-2"],
    "code": "BLA-1234",
    "name": "Interesting Lesson 2",
    "groupList": ["GROUP-1"],
    "teacherList": ["Ms. Teacher"],
    "id": "<LESSON ID>",
    "attended": null
  }
]
```

---

### `/attend`

Check if access token is still valid.

**NOTE:** The `confirmUpdate` parameter is optional, and is only used if the user has already checked in to the current course. In this case, the location value will only be updated if `confirmUpdate` is set to `true`.

Request: `POST`

```json
{
  "slab": "<SLAB ID>",
  "coordinates": { "x": 60.0, "y": 24.0 },
  "confirmUpdate": false
}
```

Response:

```json
{
  "success": true,
  "requiresUpdate": false,
  "valid": {
    "slab": true,
    "lesson": true,
    "position": true
  }
}
```
