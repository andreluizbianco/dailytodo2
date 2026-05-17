const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const storage = new Map();
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "@react-native-async-storage/async-storage") {
    return {
      __esModule: true,
      default: {
        getItem: async (key) => storage.get(key) ?? null,
        setItem: async (key, value) => storage.set(key, value),
      },
    };
  }

  return originalLoad(request, parent, isMain);
};

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
  dismissTodayOccurrence,
  loadDismissedTodayOccurrences,
} = require(path.join(__dirname, "..", "utils", "todayDismissals.ts"));

(async () => {
  const today = "2026-05-18";
  const yesterday = "2026-05-17";

  await dismissTodayOccurrence(`${today}:archived-repeat-2`);
  await dismissTodayOccurrence(`${yesterday}:archived-repeat-2`);
  await dismissTodayOccurrence(`${today}:archived-repeat-2`);

  assert.deepEqual(await loadDismissedTodayOccurrences(today), [
    `${today}:archived-repeat-2`,
  ]);

  console.log("today dismissal tests passed");
})();
