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

const { createTodoCopyFromCalendarEntry } = require(path.join(
  __dirname,
  "..",
  "utils",
  "calendarEntryActions.ts",
));

const entry = {
  id: 42,
  printedAt: "2026-05-12T09:30:00.000Z",
  todo: {
    id: 7,
    text: "Calendar note",
    note: "[ ] Keep original",
    color: "green",
    isEditing: false,
    noteType: "checkbox",
    schedule: { mode: "date", amount: 1, unit: "days" },
    reminder: { amount: 10, unit: "minutes" },
  },
};

const copiedTodo = createTodoCopyFromCalendarEntry(
  entry,
  12345,
  "2026-05-12T10:00:00.000Z",
);

assert.deepEqual(copiedTodo, {
  id: 12345,
  text: "Calendar note",
  note: "[ ] Keep original",
  color: "green",
  isEditing: false,
  noteType: "checkbox",
  schedule: { mode: "date", amount: 1, unit: "days" },
  reminder: { amount: 10, unit: "minutes" },
  createdAt: "2026-05-12T10:00:00.000Z",
  restoredFrom: {
    type: "calendar",
    originalId: 42,
    timestamp: "2026-05-12T10:00:00.000Z",
  },
});

assert.equal(entry.todo.id, 7);
assert.equal(entry.printedAt, "2026-05-12T09:30:00.000Z");

console.log("calendar entry action tests passed");
