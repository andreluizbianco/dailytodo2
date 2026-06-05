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
  getArchiveActionForSelection,
  shouldUnarchiveSelection,
} = require(path.join(__dirname, "..", "utils", "archiveAction.ts"));

assert.equal(
  getArchiveActionForSelection("notes", { type: "archive" }),
  "archive",
  "archived project notes shown in Daily should offer archive/dismiss, not unarchive",
);
assert.equal(
  shouldUnarchiveSelection("notes", { type: "archive" }),
  false,
);
assert.equal(
  getArchiveActionForSelection("projects", { type: "archive" }),
  "unarchive",
  "archived project notes shown inside Projects should offer unarchive to Daily",
);
assert.equal(
  shouldUnarchiveSelection("projects", { type: "archive" }),
  true,
);
assert.equal(
  getArchiveActionForSelection("calendar", { type: "calendar", entryId: 1 }),
  "none",
);

console.log("archive action tests passed");
