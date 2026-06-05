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

const { appendTranscriptionToNote } = require(path.join(
  __dirname,
  "..",
  "utils",
  "voiceNotes.ts",
));

assert.equal(appendTranscriptionToNote("", "hello world", "text"), "hello world");
assert.equal(
  appendTranscriptionToNote("first", " second ", "text"),
  "first\nsecond",
);
assert.equal(
  appendTranscriptionToNote("- first", "second", "bullet"),
  "- first\n- second",
);
assert.equal(
  appendTranscriptionToNote("[ ] first", "second", "checkbox"),
  "[ ] first\n[ ] second",
);
assert.equal(appendTranscriptionToNote("first", "   ", "text"), "first");

console.log("voice note tests passed");
