require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");
const { createClient } = require("@supabase/supabase-js");

const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Task API",
      version: "1.0.0",
      description: "Simple CRUD API with Express, PostgreSQL, and Supabase Auth"
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    }
  },
  apis: ["./index.js"]
};

const swaggerSpec = swaggerJsdoc(options);

// ---- Supabase Auth client ----
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ---- Postgres connection for tasks ----
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
  .then(() => console.log("Database ready. Connected to Supabase."))
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });

// ---- Stage 4: reusable auth middleware ----
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.split(" ")[1].trim() === "") {
    return res.status(401).json({
      error: "Access token required"
    });
  }

  const token = authHeader.split(" ")[1];

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({
      error: "Invalid or expired token"
    });
  }

  req.user = data.user;
  next();
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
    endpoints: ["/tasks", "/auth/signup", "/auth/login", "/auth/logout", "/public/info", "/protected/profile"]
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns server status.
 *     responses:
 *       200:
 *         description: Server is healthy
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

// ==================== AUTH ROUTES ====================

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Create a new user account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *             example:
 *               email: "test@example.com"
 *               password: "password123"
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Missing email or password
 */
app.post("/auth/signup", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password are required"
    });
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return res.status(400).json({
      error: error.message
    });
  }

  res.status(201).json(data.user);
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in and receive a JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *             example:
 *               email: "test@example.com"
 *               password: "password123"
 *     responses:
 *       200:
 *         description: Login successful, returns access token
 *       400:
 *         description: Missing email or password
 *       401:
 *         description: Invalid login credentials
 */
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password are required"
    });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return res.status(401).json({
      error: "Invalid login credentials"
    });
  }

  res.status(200).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token
  });
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log out the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Logged out successfully
 *       401:
 *         description: Missing, malformed, or invalid token
 */
app.post("/auth/logout", requireAuth, async (req, res) => {
  await supabase.auth.signOut();
  res.status(204).send();
});

// ==================== PUBLIC / PROTECTED DEMO ROUTES ====================

/**
 * @swagger
 * /public/info:
 *   get:
 *     summary: Public info, no auth required
 *     responses:
 *       200:
 *         description: Public message
 */
app.get("/public/info", (req, res) => {
  res.status(200).json({
    message: "Welcome stranger! This info is public."
  });
});

/**
 * @swagger
 * /protected/profile:
 *   get:
 *     summary: Get the logged-in user's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Missing, malformed, or invalid token
 */
app.get("/protected/profile", requireAuth, (req, res) => {
  res.status(200).json({
    id: req.user.id,
    email: req.user.email,
    created_at: req.user.created_at
  });
});

/**
 * @swagger
 * /protected/dashboard:
 *   get:
 *     summary: Another protected route using the same middleware
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 *       401:
 *         description: Missing, malformed, or invalid token
 */
app.get("/protected/dashboard", requireAuth, (req, res) => {
  res.status(200).json({
    message: `Welcome to your dashboard, ${req.user.email}!`
  });
});

// ==================== TASK CRUD ROUTES ====================

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Get all tasks
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
