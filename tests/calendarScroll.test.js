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

const { getScrollYToRevealRange } = require(path.join(
  __dirname,
  "..",
  "utils",
  "scrollVisibility.ts",
));

assert.equal(
  getScrollYToRevealRange({
    contentHeight: 1000,
    currentScrollY: 100,
    margin: 8,
    rangeHeight: 260,
    rangeY: 250,
    viewportHeight: 400,
  }),
  118,
);

assert.equal(
  getScrollYToRevealRange({
    contentHeight: 1000,
    currentScrollY: 0,
    margin: 8,
    rangeHeight: 220,
    rangeY: 120,
    viewportHeight: 400,
  }),
  0,
);

assert.equal(
  getScrollYToRevealRange({
    contentHeight: 1000,
    currentScrollY: 500,
    margin: 8,
    rangeHeight: 160,
    rangeY: 420,
    viewportHeight: 400,
  }),
  412,
);

assert.equal(
  getScrollYToRevealRange({
    contentHeight: 1000,
    currentScrollY: 0,
    margin: 8,
    rangeHeight: 460,
    rangeY: 300,
    viewportHeight: 400,
  }),
  292,
);

console.log("calendar scroll tests passed");
