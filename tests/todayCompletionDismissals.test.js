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

const { getCompletionDismissalSources } = require(path.join(
  __dirname,
  "..",
  "utils",
  "todayCompletionDismissals.ts",
));

assert.deepEqual(
  getCompletionDismissalSources(
    {
      id: 7,
      schedule: { mode: "every", amount: 1, unit: "days" },
    },
    { type: "active", todoId: 7 },
  ),
  [
    { type: "active", todoId: 7 },
    { type: "archived-repeat", todoId: 7 },
  ],
  "completed active repeats should also dismiss their archived daily occurrence",
);

assert.deepEqual(
  getCompletionDismissalSources(
    { id: 8 },
    { type: "active", todoId: 8 },
  ),
  [{ type: "active", todoId: 8 }],
);

assert.deepEqual(
  getCompletionDismissalSources(
    { id: 9 },
    { type: "archived-repeat", todoId: 9 },
  ),
  [{ type: "archived-repeat", todoId: 9 }],
);

console.log("today completion dismissal tests passed");
