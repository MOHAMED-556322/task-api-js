# Task API

A small CRUD API for managing a to-do list, built with **Node.js** and **Express**. Data is stored in **PostgreSQL** (running in Docker), and the API is secured with **Supabase Auth** — sign up, log in, log out, and protected routes guarded by JWT verification.

Built as part of the FlyRank Internship — Backend Track, Weeks 1–4, Assignments A1–A4.

## Features

- Full CRUD on tasks: Create, Read, Update, Delete
- Data persisted in PostgreSQL, running in Docker — survives restarts
- User authentication via **Supabase Auth**: sign up, log in, log out
- Protected routes guarded by a reusable auth middleware that verifies JWTs
- The entire stack (app + database) starts with one command: `docker compose up`
- Input validation with proper HTTP status codes
- Interactive API docs with Swagger UI, including a Bearer-token "Authorize" flow
- All database queries use parameterized placeholders (no SQL injection)
- Secrets (database and Supabase credentials) come from a git-ignored `.env` file — never hardcoded

## How authentication works

This project does not write any password hashing or token-signing logic itself. **Supabase** is the Identity Provider: it stores accounts, hashes passwords, and issues signed JSON Web Tokens (JWTs). The API's job is only to:

1. Forward signup/login credentials to Supabase.
2. Receive the JWT Supabase hands back.
3. On protected routes, verify that JWT with Supabase before letting the request through.

```
Client → (email/password) → Supabase Auth → JWT
Client → (JWT in Authorization header) → this API → verifies with Supabase → 200 or 401
```

## How to run

**Requirements:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running, and a free [Supabase](https://supabase.com) project.

1. Clone this repo:
   ```bash
   git clone https://github.com/MOHAMED-556322/task-api-js.git
   cd task-api-js
   ```
2. Copy the example environment file and fill in your own Supabase project's values:
   ```bash
   cp .env.example .env
   ```
3. Start the whole stack (API + Postgres) with one command:
   ```bash
   docker compose up
   ```
4. The API is now running at `http://localhost:3000`

## Environment variables

See `.env.example` for the required variables:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
DATABASE_URL=postgres://postgres:dev@localhost:5432/tasks
PORT=3000
```

`.env` itself is git-ignored and never committed. Get your own `SUPABASE_URL` and `SUPABASE_KEY` (the **anon/publishable** key — never the `service_role` key) from your Supabase project's **Settings → API** page.

## Endpoints

| Method | Path                  | Description                        | Auth required |
|--------|-----------------------|-------------------------------------|----------------|
| GET    | `/`                   | API info                            | No             |
| GET    | `/health`             | Health check                        | No             |
| POST   | `/auth/signup`        | Create a new user account           | No             |
| POST   | `/auth/login`         | Log in, returns a JWT               | No             |
| POST   | `/auth/logout`        | Log out the current user            | Yes (Bearer)   |
| GET    | `/public/info`        | Public, open info                   | No             |
| GET    | `/protected/profile`  | The logged-in user's profile        | Yes (Bearer)   |
| GET    | `/protected/dashboard`| Another route using the same guard  | Yes (Bearer)   |
| GET    | `/tasks`              | Get all tasks                       | No             |
| GET    | `/tasks/:id`          | Get a single task by id             | No             |
| POST   | `/tasks`              | Create a new task                   | No             |
| PUT    | `/tasks/:id`          | Update an existing task             | No             |
| DELETE | `/tasks/:id`          | Delete a task                       | No             |

## Example auth flow (curl)

```bash
# 1. Sign up
curl -i -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# -> 201 Created

# 2. Log in
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# -> 200 OK, returns { "access_token": "...", "refresh_token": "..." }

# 3. Call a protected route with the token
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer <PASTE_ACCESS_TOKEN_HERE>"
# -> 200 OK, returns the user's id, email, created_at

# 4. Tamper with the token and try again
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer <TAMPERED_TOKEN>"
# -> 401 Unauthorized, { "error": "Invalid or expired token" }
```

## Swagger UI

Interactive API docs — including a padlock icon on every protected route and an "Authorize" button for pasting a Bearer token once and reusing it — are available at:

```
http://localhost:3000/docs
```

![Swagger UI with bearer auth](swagger-auth-screenshot.png)

## Exploring the database directly

```bash
docker exec -it task-api-js-db-1 psql -U postgres -d tasks -c "SELECT * FROM tasks;"
```

![Postgres screenshot](postgres-screenshot.png)

## Notes

- Passwords are never handled, stored, or hashed by this API — Supabase does that entirely.
- The `requireAuth` middleware is written once and reused on every protected route (`/auth/logout`, `/protected/profile`, `/protected/dashboard`) — adding a new protected route needs no new auth code.
- `401 Unauthorized` means "I don't know who you are" (missing, malformed, or invalid/expired token). A `403 Forbidden` (not implemented here) would mean "I know who you are, and you still can't."
- The `tasks` table and its 3 seed tasks are created automatically on first run.
- All CRUD operations use parameterized SQL queries (`$1`, `$2`, ...) to prevent SQL injection.
