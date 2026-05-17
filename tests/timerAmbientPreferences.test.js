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

require.extensions[".mp3"] = function loadMp3(module, filename) {
  module.exports = filename;
};

const {
  parseAmbientSoundEnabled,
  parseAmbientSoundId,
} = require(path.join(
  __dirname,
  "..",
  "utils",
  "timerAmbientPreferences.ts",
));

assert.equal(parseAmbientSoundEnabled("true"), true);
assert.equal(parseAmbientSoundEnabled("false"), false);
assert.equal(parseAmbientSoundEnabled(null), false);
assert.equal(parseAmbientSoundEnabled("unexpected"), false);

assert.equal(parseAmbientSoundId("waterfall"), "waterfall");
assert.equal(parseAmbientSoundId("rain"), "rain");
assert.equal(parseAmbientSoundId("gentle-rain"), "gentle-rain");
assert.equal(parseAmbientSoundId(null), "rain");
assert.equal(parseAmbientSoundId("cafe"), "rain");

console.log("timer ambient preference tests passed");
