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
  applyTodayDisplayOrder,
  createTodayDisplayOrder,
  sortTodayItemsByDisplayTime,
} = require(path.join(__dirname, "..", "utils", "todayOrder.ts"));

const makeItem = (key, text, sortTimeMinutes) => ({
  occurrenceKey: String(key),
  sortTimeMinutes,
  todo: {
    id: key,
    text,
    note: "",
    color: "blue",
    isEditing: false,
    noteType: "text",
  },
  source: { type: "active", todoId: key },
});

const early = makeItem(1, "09:00", 9 * 60);
const late = makeItem(2, "14:00", 14 * 60);
const noTime = makeItem(3, "No time");
const noon = makeItem(4, "12:00", 12 * 60);

assert.deepEqual(
  sortTodayItemsByDisplayTime([noon, noTime, early, late]).map(
    (item) => item.todo.text,
  ),
  ["09:00", "12:00", "14:00", "No time"],
);

assert.deepEqual(
  applyTodayDisplayOrder([early, late, noTime, noon], ["2", "3"]).map(
    (item) => item.todo.text,
  ),
  ["14:00", "No time", "09:00", "12:00"],
);

assert.deepEqual(createTodayDisplayOrder([late, early]), ["2", "1"]);

console.log("today order tests passed");
