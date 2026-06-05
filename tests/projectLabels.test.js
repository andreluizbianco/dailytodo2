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

const { getProjectDisplayLabel } = require(path.join(
  __dirname,
  "..",
  "utils",
  "projectLabels.ts",
));

const projects = [
  { id: 1, title: "Music", color: "yellow" },
  { id: 2, title: "   ", color: "blue", parentProjectId: 1 },
  { id: 3, title: "Piano", color: "green", parentProjectId: 1 },
];

assert.equal(getProjectDisplayLabel(projects, undefined), "");
assert.equal(getProjectDisplayLabel(projects, 1), "Music");
assert.equal(getProjectDisplayLabel(projects, 2), "Untitled");
assert.equal(getProjectDisplayLabel(projects, 3), "Piano");
assert.equal(getProjectDisplayLabel(projects, 999), "");

console.log("project label tests passed");
