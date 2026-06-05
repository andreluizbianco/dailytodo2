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

const { getCalendarAutoScrollKey } = require(path.join(
  __dirname,
  "..",
  "utils",
  "calendarAutoScroll.ts",
));

assert.equal(
  getCalendarAutoScrollKey({
    dayTimelineMode: false,
    selectedDate: "2026-05-31",
    viewMode: "day",
  }),
  "day:2026-05-31:list",
);

assert.equal(
  getCalendarAutoScrollKey({
    dayTimelineMode: false,
    entriesVersion: 1,
    selectedDate: "2026-05-31",
    viewMode: "day",
  }),
  getCalendarAutoScrollKey({
    dayTimelineMode: false,
    entriesVersion: 2,
    selectedDate: "2026-05-31",
    viewMode: "day",
  }),
  "editing entries should not create a new auto-scroll key",
);

assert.notEqual(
  getCalendarAutoScrollKey({
    dayTimelineMode: false,
    selectedDate: "2026-05-31",
    viewMode: "day",
  }),
  getCalendarAutoScrollKey({
    dayTimelineMode: true,
    selectedDate: "2026-05-31",
    viewMode: "day",
  }),
  "switching timeline mode should create a new auto-scroll key",
);

console.log("calendar auto-scroll tests passed");
