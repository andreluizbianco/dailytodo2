const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
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

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "react-native") {
    return {
      NativeModules: {},
      Platform: { OS: "test" },
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

const { shouldOpenTimerViewForNotificationTarget } = require(path.join(
  __dirname,
  "..",
  "utils",
  "notificationTargets.ts",
));
const { getTodoPomodoroDurationSeconds } = require(path.join(
  __dirname,
  "..",
  "utils",
  "reminders.ts",
));

assert.equal(shouldOpenTimerViewForNotificationTarget("timer"), true);
assert.equal(shouldOpenTimerViewForNotificationTarget("reminder"), false);
assert.equal(shouldOpenTimerViewForNotificationTarget(undefined), false);

assert.equal(
  getTodoPomodoroDurationSeconds({
    timer: { hours: "00", minutes: "13", isActive: false },
  }),
  13 * 60,
);
assert.equal(
  getTodoPomodoroDurationSeconds({
    timer: { hours: "01", minutes: "10", isActive: false },
  }),
  70 * 60,
);
assert.equal(getTodoPomodoroDurationSeconds({}), 25 * 60);

console.log("notification target tests passed");
