const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = function loadTs(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(output, filename);
};

const {
  createTrashedTodo,
  getRetainedTrashedTodos,
  restoreTodoFromTrash,
} = require(path.join(__dirname, "..", "utils", "trash.ts"));

const todo = {
  id: 7,
  text: "Deleted note",
  note: "Body",
  color: "blue",
  isEditing: true,
  noteType: "text",
  createdAt: "2026-05-01T12:00:00.000Z",
};

assert.deepEqual(createTrashedTodo(todo, "2026-05-12T12:00:00.000Z"), {
  ...todo,
  isEditing: false,
  deletedAt: "2026-05-12T12:00:00.000Z",
});

assert.deepEqual(
  restoreTodoFromTrash({
    ...todo,
    isEditing: false,
    deletedAt: "2026-05-12T12:00:00.000Z",
  }),
  {
    ...todo,
    isEditing: false,
  },
);

const trashedTodos = [
  { ...todo, id: 1, deletedAt: "2026-05-09T12:00:00.000Z" },
  { ...todo, id: 2, deletedAt: "2026-05-08T11:59:59.000Z" },
  { ...todo, id: 3, deletedAt: "2026-04-13T12:00:00.000Z" },
];

assert.deepEqual(
  getRetainedTrashedTodos(
    trashedTodos,
    "3d",
    "2026-05-12T12:00:00.000Z",
  ).map((item) => item.id),
  [1],
);

assert.deepEqual(
  getRetainedTrashedTodos(
    trashedTodos,
    "30d",
    "2026-05-12T12:00:00.000Z",
  ).map((item) => item.id),
  [1, 2, 3],
);

assert.deepEqual(
  getRetainedTrashedTodos(
    trashedTodos,
    "never",
    "2026-05-12T12:00:00.000Z",
  ).map((item) => item.id),
  [1, 2, 3],
);

console.log("trash helper tests passed");
