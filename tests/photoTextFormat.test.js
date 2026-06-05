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

const { formatPhotoScanText } = require(path.join(
  __dirname,
  "..",
  "utils",
  "photoTextFormat.ts",
));

const scanResult = {
  text: "Title\nfirst line\nsecond line\n\nNext block",
  blocks: [
    { text: "Title\nfirst line\nsecond line", lines: ["Title", "first line", "second line"] },
    { text: "Next block", lines: ["Next block"] },
  ],
};

assert.equal(
  formatPhotoScanText(scanResult, "lines"),
  "Title\nfirst line\nsecond line\n\nNext block",
);
assert.equal(
  formatPhotoScanText(scanResult, "paragraph"),
  "Title first line second line\n\nNext block",
);
assert.equal(
  formatPhotoScanText(scanResult, "compact"),
  "Title first line second line Next block",
);

console.log("photo text format tests passed");
