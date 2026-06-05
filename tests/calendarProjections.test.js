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

const { buildCalendarProjections } = require(path.join(
  __dirname,
  "..",
  "utils",
  "calendarProjections.ts",
));

const repeatTodo = {
  id: 1,
  text: "Weekly check",
  note: "",
  color: "blue",
  isEditing: false,
  noteType: "text",
  schedule: {
    mode: "every",
    amount: 1,
    unit: "days",
    startsAt: new Date().toISOString(),
    time: "09:00",
  },
};

const oneWeekProjections = buildCalendarProjections({
  archivedTodos: [],
  calendarEntries: [],
  range: "1w",
  todos: [repeatTodo],
});

assert.equal(oneWeekProjections.length, 8);

console.log("calendar projection tests passed");
