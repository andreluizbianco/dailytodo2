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

const { getTodayTodoRenderKey } = require(path.join(
  __dirname,
  "..",
  "utils",
  "todayKeys.ts",
));

const activeTodo = { id: 7, text: "Same note" };
const calendarTodo = { id: 7, text: "Same note" };
const orderedTodayItems = [
  { todo: activeTodo, occurrenceKey: "2026-05-31:active-7" },
  { todo: calendarTodo, occurrenceKey: "2026-05-31:calendar-99" },
];

assert.equal(
  getTodayTodoRenderKey(activeTodo, orderedTodayItems),
  "2026-05-31:active-7",
);
assert.equal(
  getTodayTodoRenderKey(calendarTodo, orderedTodayItems),
  "2026-05-31:calendar-99",
  "same todo id from a different source should keep its own render key",
);

console.log("today key tests passed");
