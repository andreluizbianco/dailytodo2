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
  SCHEDULE_MODES,
  createLocalDateTarget,
  formatScheduleDateParts,
  parseScheduleDateParts,
  updateSchedule,
} = require(path.join(
  __dirname,
  "..",
  "utils",
  "schedule.ts",
));
const { isScheduleDueOnDay } = require(path.join(
  __dirname,
  "..",
  "utils",
  "todayView.ts",
));

const staleRepeatingSchedule = {
  mode: "every",
  amount: 1,
  unit: "days",
  startsAt: "2020-01-01T09:00:00.000Z",
  time: "09:00",
};

const updatedSchedule = updateSchedule(staleRepeatingSchedule, {
  mode: "in",
  amount: 1,
  unit: "days",
});
const today = new Date();
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

assert.equal(updatedSchedule.mode, "in");
assert.equal(
  isScheduleDueOnDay(updatedSchedule, tomorrow),
  true,
  "changing an old schedule to in 1 day should be due tomorrow",
);
assert.equal(
  isScheduleDueOnDay(updatedSchedule, today),
  false,
  "changing to in 1 day should not be due today",
);

const yesterdayRepeatingSchedule = {
  ...staleRepeatingSchedule,
  startsAt: yesterday.toISOString(),
};

const updatedRepeatingSchedule = updateSchedule(yesterdayRepeatingSchedule, {
  amount: 2,
  unit: "days",
});

assert.equal(updatedRepeatingSchedule.mode, "every");
assert.equal(
  isScheduleDueOnDay(updatedRepeatingSchedule, today),
  true,
  "changing a repeating rhythm should restart it from today",
);

const timeOnlyUpdate = updateSchedule(staleRepeatingSchedule, {
  time: "15:30",
});

assert.equal(timeOnlyUpdate.time, "15:30");
assert.equal(
  timeOnlyUpdate.startsAt,
  staleRepeatingSchedule.startsAt,
  "changing only the time should not restart the repeating rhythm",
);

assert.deepEqual(
  SCHEDULE_MODES,
  ["every", "in", "date"],
  "repeat mode wheel should include one-time date mode",
);

const targetDate = createLocalDateTarget(2026, 5, 29);
const oneTimeSchedule = updateSchedule(staleRepeatingSchedule, {
  mode: "date",
  targetDate,
  time: "14:20",
});
const dueDate = new Date(2026, 4, 29);
const nextDate = new Date(2026, 4, 30);

assert.equal(oneTimeSchedule.mode, "date");
assert.equal(
  isScheduleDueOnDay(oneTimeSchedule, dueDate),
  true,
  "one-time date schedule should be due on the selected local day",
);
assert.equal(
  isScheduleDueOnDay(oneTimeSchedule, nextDate),
  false,
  "one-time date schedule should not repeat on the next local day",
);
assert.equal(
  new Date(oneTimeSchedule.nextAt).getHours(),
  14,
  "one-time date schedule should keep the selected time",
);

assert.deepEqual(
  formatScheduleDateParts(targetDate, "dmy"),
  { day: "29", month: "05", year: "2026" },
  "date editor should expose day/month/year parts from stable target date",
);
assert.equal(
  parseScheduleDateParts({ day: "31", month: "02", year: "2026" }, "dmy", targetDate),
  targetDate,
  "invalid date edits should keep the previous target date",
);
assert.equal(
  parseScheduleDateParts({ day: "12", month: "06", year: "2026" }, "dmy", targetDate),
  createLocalDateTarget(2026, 6, 12),
  "valid date edits should create a stable local target date",
);

console.log("schedule tests passed");
