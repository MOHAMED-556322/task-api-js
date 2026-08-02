const express = require("express");
const Database = require("better-sqlite3");

const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const app = express();
const PORT = 3000;

app.use(express.json());

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Task API",
      version: "1.0.0",
      description: "Simple CRUD API with Express and SQLite"
    }
  },
  apis: ["./index.js"]
};

const swaggerSpec = swaggerJsdoc(options);

// ---- Stage 0: create/open the database and table ----
const db = new Database("tasks.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  )
`);

// Seed 3 example tasks, but only if the table is empty
const row = db.prepare("SELECT COUNT(*) AS count FROM tasks").get();
if (row.count === 0) {
  const insertSeed = db.prepare("INSERT INTO tasks (title, done) VALUES (?, ?)");
  const seedMany = db.transaction((seedTasks) => {
    for (const t of seedTasks) {
      insertSeed.run(t.title, t.done ? 1 : 0);
    }
  });
  seedMany([
    { title: "Study", done: false },
    { title: "Gym", done: true },
    { title: "Sleep", done: false }
  ]);
}

// Helper: convert a DB row (done as 0/1) into the same shape the API returned before (done as true/false)
function toApiTask(row) {
  return {
    id: row.id,
    title: row.title,
    done: !!row.done
  };
}

/**
 * @swagger
 * /:
 *   get:
 *     summary: API info
 *     description: Returns basic info about the API and its endpoints.
 *     responses:
 *       200:
 *         description: API info object
 */
app.get("/", (req, res) => {
  res.json({
    name: "Task API",
    version: "1.0",
    endpoints: ["/tasks"]
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns server status. Used to confirm the server is alive.
 *     responses:
 *       200:
 *         description: Server is healthy
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Get all tasks
 *     description: Returns the full list of tasks from the SQLite database.
 *     responses:
 *       200:
 *         description: List of tasks
 */
app.get("/tasks", (req, res) => {
  const rows = db.prepare("SELECT * FROM tasks").all();
  res.status(200).json(rows.map(toApiTask));
});

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     summary: Get a single task by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The task id
 *     responses:
 *       200:
 *         description: The requested task
 *       404:
 *         description: Task not found
 */
app.get("/tasks/:id", (req, res) => {
  const taskId = Number(req.params.id);

  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);

  if (!row) {
    return res.status(404).json({
      error: `Task ${taskId} not found`
    });
  }

  res.status(200).json(toApiTask(row));
});

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: Create a new task
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *             example:
 *               title: "Buy milk"
 *     responses:
 *       201:
 *         description: Task created
 *       400:
 *         description: Invalid or missing title
 */
app.post("/tasks", (req, res) => {
  const { title } = req.body;

  if (typeof title !== "string" || title.trim() === "") {
    return res.status(400).json({
      error: "Title cannot be empty"
    });
  }

  const insert = db.prepare("INSERT INTO tasks (title, done) VALUES (?, ?)");
  const result = insert.run(title.trim(), 0);

  const newTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid);

  res.status(201).json(toApiTask(newTask));
});

/**
 * @swagger
 * /tasks/{id}:
 *   put:
 *     summary: Update an existing task
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The task id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               done:
 *                 type: boolean
 *             example:
 *               title: "Buy milk and bread"
 *               done: true
 *     responses:
 *       200:
 *         description: Task updated
 *       400:
 *         description: Invalid or missing title
 *       404:
 *         description: Task not found
 */
app.put("/tasks/:id", (req, res) => {
  const taskId = Number(req.params.id);

  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);

  if (!existing) {
    return res.status(404).json({
      error: `Task ${taskId} not found`
    });
  }

  const { title, done } = req.body;

  if (typeof title !== "string" || title.trim() === "") {
    return res.status(400).json({
      error: "Title cannot be empty"
    });
  }

  db.prepare("UPDATE tasks SET title = ?, done = ? WHERE id = ?").run(
    title.trim(),
    done ? 1 : 0,
    taskId
  );

  const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);

  res.json(toApiTask(updated));
});

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     summary: Delete a task
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The task id
 *     responses:
 *       204:
 *         description: Task deleted, no content returned
 *       404:
 *         description: Task not found
 */
app.delete("/tasks/:id", (req, res) => {
  const taskId = Number(req.params.id);

  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);

  if (!existing) {
    return res.status(404).json({
      error: `Task ${taskId} not found`
    });
  }

  db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);

  res.status(204).send();
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});