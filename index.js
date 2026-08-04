const express = require("express");
const { Pool } = require("pg");

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
      description: "Simple CRUD API with Express and PostgreSQL"
    }
  },
  apis: ["./index.js"]
};

const swaggerSpec = swaggerJsdoc(options);

// ---- Stage 1: connect to Postgres using DATABASE_URL from .env ----
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function connectWithRetry(maxAttempts = 10, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      console.log(`Database not ready yet (attempt ${attempt}/${maxAttempts})...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Could not connect to the database after multiple attempts");
}

async function initDb() {
  await connectWithRetry();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT false
    )
  `);

  const { rows } = await pool.query("SELECT COUNT(*) AS count FROM tasks");
  if (Number(rows[0].count) === 0) {
    await pool.query(
      "INSERT INTO tasks (title, done) VALUES ($1, $2), ($3, $4), ($5, $6)",
      ["Study", false, "Gym", true, "Sleep", false]
    );
  }
}

initDb()
  .then(() => console.log("Database ready"))
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });

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
 *     description: Returns the full list of tasks from PostgreSQL.
 *     responses:
 *       200:
 *         description: List of tasks
 */
app.get("/tasks", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM tasks ORDER BY id");
  res.status(200).json(rows);
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
app.get("/tasks/:id", async (req, res) => {
  const taskId = Number(req.params.id);

  const { rows } = await pool.query("SELECT * FROM tasks WHERE id = $1", [taskId]);

  if (rows.length === 0) {
    return res.status(404).json({
      error: `Task ${taskId} not found`
    });
  }

  res.status(200).json(rows[0]);
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
app.post("/tasks", async (req, res) => {
  const { title } = req.body;

  if (typeof title !== "string" || title.trim() === "") {
    return res.status(400).json({
      error: "Title cannot be empty"
    });
  }

  const { rows } = await pool.query(
    "INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *",
    [title.trim(), false]
  );

  res.status(201).json(rows[0]);
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
app.put("/tasks/:id", async (req, res) => {
  const taskId = Number(req.params.id);

  const existing = await pool.query("SELECT * FROM tasks WHERE id = $1", [taskId]);

  if (existing.rows.length === 0) {
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

  const { rows } = await pool.query(
    "UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING *",
    [title.trim(), !!done, taskId]
  );

  res.json(rows[0]);
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
app.delete("/tasks/:id", async (req, res) => {
  const taskId = Number(req.params.id);

  const existing = await pool.query("SELECT * FROM tasks WHERE id = $1", [taskId]);

  if (existing.rows.length === 0) {
    return res.status(404).json({
      error: `Task ${taskId} not found`
    });
  }

  await pool.query("DELETE FROM tasks WHERE id = $1", [taskId]);

  res.status(204).send();
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
