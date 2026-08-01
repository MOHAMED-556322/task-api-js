const express = require("express");

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
      description: "Simple CRUD API with Express"
    }
  },
  apis: ["./index.js"]
};

const swaggerSpec = swaggerJsdoc(options);

const tasks = [
  { id: 1, title: "Study", done: false },
  { id: 2, title: "Gym", done: true },
  { id: 3, title: "Sleep", done: false }
];

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
 *     description: Returns the full list of tasks currently in memory.
 *     responses:
 *       200:
 *         description: List of tasks
 */
app.get("/tasks", (req, res) => {
  res.status(200).json(tasks);
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

  const task = tasks.find((task) => task.id === taskId);

  if (!task) {
    return res.status(404).json({
      error: `Task ${taskId} not found`
    });
  }

  res.status(200).json(task);
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

  const nextId =
    tasks.length === 0
      ? 1
      : Math.max(...tasks.map((task) => task.id)) + 1;

  const newTask = {
    id: nextId,
    title: title.trim(),
    done: false
  };

  tasks.push(newTask);

  res.status(201).json(newTask);
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

  const task = tasks.find((task) => task.id === taskId);

  if (!task) {
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

  task.title = title.trim();
  task.done = done;

  res.json(task);
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

  const index = tasks.findIndex((task) => task.id === taskId);

  if (index === -1) {
    return res.status(404).json({
      error: `Task ${taskId} not found`
    });
  }

  tasks.splice(index, 1);

  res.status(204).send();
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});