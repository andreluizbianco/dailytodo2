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

const { getArchivePreviewItems, getArchivePreviewText } = require(path.join(
  __dirname,
  "..",
  "utils",
  "archivePreview.ts",
));

assert.equal(getArchivePreviewText("[ ] Buy milk\n[x] Send invoice"), "Buy milk\nSend invoice");
assert.equal(getArchivePreviewText("- Draft outline\n- Review notes"), "Draft outline\nReview notes");
assert.equal(getArchivePreviewText("  \n\t"), "");

assert.deepEqual(getArchivePreviewItems("Plain\nSecond", "text"), [
  { type: "text", text: "Plain" },
  { type: "text", text: "Second" },
]);

assert.deepEqual(getArchivePreviewItems("- Draft\n- Review", "bullet"), [
  { type: "bullet", text: "Draft" },
  { type: "bullet", text: "Review" },
]);

assert.deepEqual(getArchivePreviewItems("[ ] Open\n[x] Done", "checkbox"), [
  { type: "checkbox", text: "Open", checked: false },
  { type: "checkbox", text: "Done", checked: true },
]);

console.log("archive preview tests passed");
