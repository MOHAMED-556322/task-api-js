# Task API

A small CRUD API for managing a to-do list, built with **Node.js** and **Express**. Data is stored in memory (no database) — it resets every time the server restarts.

Built as part of the FlyRank Internship — Backend Track, Week 2, Assignment A1.

## Features

- Full CRUD on tasks: Create, Read, Update, Delete
- Input validation with proper HTTP status codes
- Interactive API docs with Swagger UI

## How to run

1. Clone this repo:
```bash
   git clone https://github.com/MOHAMED-556322/task-api-js.git
   cd task-api-js
```
2. Install dependencies:
```bash
   npm install
```
3. Start the server:
```bash
   node index.js
```
4. The API is now running at `http://localhost:3000`

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
curl -i http://localhost:3000/tasks/1
```