# Task API

A small CRUD API for managing a to-do list, built with **Node.js** and **Express**. Data is stored in **PostgreSQL**, running in a **Docker container** — the whole stack (API + database) starts with a single command.

Built as part of the FlyRank Internship — Backend Track, Weeks 1–3, Assignments A1, A2, and A3.

## Features

- Full CRUD on tasks: Create, Read, Update, Delete
- Data persisted in PostgreSQL, running in Docker — survives restarts and container recreation
- The entire stack (app + database) starts with one command: `docker compose up`
- Input validation with proper HTTP status codes
- Interactive API docs with Swagger UI
- All database queries use parameterized placeholders (no SQL injection)
- Secrets (database credentials) come from a git-ignored `.env` file — never hardcoded

## Storage evolution

This project has moved through three storage layers, with the API staying identical the whole way:

| Stage | Where tasks live | What runs it |
|-------|-------------------|---------------|
| A1 | a list in memory | the Node process |
| A2 | a `tasks.db` file | SQLite, on disk |
| A3 (current) | rows in a `tasks` table | PostgreSQL, in a Docker container |

## How to run

**Requirements:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

1. Clone this repo:
   ```bash
   git clone https://github.com/MOHAMED-556322/task-api-js.git
   cd task-api-js
   ```
2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
3. Start the whole stack (API + Postgres) with one command:
   ```bash
   docker compose up
   ```
4. The API is now running at `http://localhost:3000`

On first run, the app automatically creates the `tasks` table and seeds 3 example tasks (Study, Gym, Sleep) — this only happens once. Data lives in a Docker volume, so it survives `docker compose down` followed by `docker compose up` again.

## Environment variables

See `.env.example` for the required variable:

```
DATABASE_URL=postgres://postgres:dev@localhost:5432/tasks
```

`.env` itself is git-ignored and never committed — it holds the real connection string (including the database password).

## Endpoints

| Method | Path          | Description                    | Success | Errors        |
|--------|---------------|---------------------------------|---------|---------------|
| GET    | `/`           | API info                        | 200     | —             |
| GET    | `/health`     | Health check                    | 200     | —             |
| GET    | `/tasks`      | Get all tasks                   | 200     | —             |
| GET    | `/tasks/:id`  | Get a single task by id         | 200     | 404           |
| POST   | `/tasks`      | Create a new task               | 201     | 400           |
| PUT    | `/tasks/:id`  | Update an existing task         | 200     | 400, 404      |
| DELETE | `/tasks/:id`  | Delete a task                   | 204     | 404           |

## Example request

```bash
curl -i http://localhost:3000/tasks
```

```
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

[{"id":1,"title":"Study","done":false},{"id":2,"title":"Gym","done":true},{"id":3,"title":"Sleep","done":false}]
```

## Swagger UI

Interactive API docs (with a "Try it out" button for every endpoint) are available at:

```
http://localhost:3000/docs
```

![Swagger UI screenshot](swagger-screenshot.png)

## Exploring the database directly

With the stack running, the Postgres data can be inspected with `psql` inside the container:

```bash
docker exec -it task-api-js-db-1 psql -U postgres -d tasks -c "SELECT * FROM tasks;"
```

![Postgres screenshot](postgres-screenshot.png)

## Persistence proof

Tasks created while the stack is running survive a full stack restart:

1. Create a task via the API.
2. Run `docker compose down` (stops and removes the containers).
3. Run `docker compose up` again.
4. `GET /tasks` still shows the task created in step 1 — because the Docker volume kept the data, independent of the containers themselves.

## Notes

- The `tasks` table and its 3 seed tasks are created automatically on first run; the seed only runs when the table is empty.
- All CRUD operations use parameterized SQL queries (`$1`, `$2`, ...) to prevent SQL injection.
- The app retries its database connection on startup, since Postgres can take a few seconds to become ready inside its own container.