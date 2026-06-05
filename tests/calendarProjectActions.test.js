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

const { detachCalendarEntryFromProject } = require(path.join(
  __dirname,
  "..",
  "utils",
  "calendarProjectActions.ts",
));

const entries = [
  {
    id: 1,
    printedAt: "2026-05-25T10:00:00.000Z",
    todo: {
      id: 10,
      text: "Past event",
      note: "",
      color: "blue",
      isEditing: false,
      noteType: "text",
      projectId: 99,
    },
  },
];

const updatedEntries = detachCalendarEntryFromProject(entries, 1);

assert.equal(updatedEntries.length, 1);
assert.equal(updatedEntries[0].id, 1);
assert.equal(updatedEntries[0].todo.projectId, undefined);
assert.equal(entries[0].todo.projectId, 99);

console.log("calendar project action tests passed");
