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
  getNativeVoiceLanguageTag,
  isVoiceLanguagePreference,
} = require(path.join(__dirname, "..", "utils", "voicePreferences.ts"));

assert.equal(isVoiceLanguagePreference("system"), true);
assert.equal(isVoiceLanguagePreference("pt-PT"), true);
assert.equal(isVoiceLanguagePreference("banana"), false);
assert.equal(getNativeVoiceLanguageTag("system"), null);
assert.equal(getNativeVoiceLanguageTag("pt-BR"), "pt-BR");

console.log("voice preference tests passed");
