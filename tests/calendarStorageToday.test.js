const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "@react-native-async-storage/async-storage") {
    return {
      __esModule: true,
      default: {
        getItem: async () => null,
        setItem: async () => undefined,
      },
    };
  }

  return originalLoad(request, parent, isMain);
};

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

const { replaceCalendarEntry } = require(path.join(
  __dirname,
  "..",
  "utils",
  "calendarStorage.ts",
));

const entries = [
  {
    id: 10,
    printedAt: "2026-05-18T09:00:00.000Z",
    todo: {
      id: 5,
      text: "Original",
      note: "",
      color: "blue",
      isEditing: false,
      noteType: "text",
    },
  },
];

const nextEntries = replaceCalendarEntry(entries, 10, {
  id: 10,
  printedAt: "2026-05-18T10:30:00.000Z",
  todo: {
    id: 5,
    text: "Original",
    note: "done",
    color: "blue",
    isEditing: false,
    noteType: "text",
  },
  timerCompleted: true,
  isTrackingEntry: true,
  timeSpent: { elapsed: 25 },
});

assert.equal(nextEntries.length, 1);
assert.equal(nextEntries[0].printedAt, "2026-05-18T10:30:00.000Z");
assert.equal(nextEntries[0].timerCompleted, true);

console.log("calendar storage today tests passed");
