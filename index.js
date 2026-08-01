const express = require("express");

const app = express();
const PORT = 3000;

app.use(express.json());

const tasks = [
  { id: 1, title: "Study", done: false },
  { id: 2, title: "Gym", done: true },
  { id: 3, title: "Sleep", done: false }
];

app.get("/", (req, res) => {
  res.json({
    name: "Task API",
    version: "1.0",
    endpoints: ["/tasks"]
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

app.get("/tasks", (req, res) => {
  res.status(200).json(tasks);
});

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
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});