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
  buildTodayItems,
  getDayKey,
  getTodayOccurrenceKey,
  isScheduleDueOnDay,
} = require(path.join(__dirname, "..", "utils", "todayView.ts"));

const monday = new Date("2026-05-18T12:00:00.000Z");

const activeTodo = {
  id: 1,
  text: "Active",
  note: "",
  color: "blue",
  isEditing: false,
  noteType: "text",
};

const archivedEveryDay = {
  id: 2,
  text: "Daily archive",
  note: "",
  color: "yellow",
  isEditing: false,
  noteType: "text",
  schedule: {
    mode: "every",
    amount: 1,
    unit: "days",
    startsAt: "2026-05-10T09:00:00.000Z",
    time: "09:00",
  },
};

const archivedEveryTwoDays = {
  id: 3,
  text: "Every two",
  note: "",
  color: "pink",
  isEditing: false,
  noteType: "text",
  schedule: {
    mode: "every",
    amount: 2,
    unit: "days",
    startsAt: "2026-05-16T09:00:00.000Z",
    time: "09:00",
  },
};

const archivedWeeklyWednesday = {
  id: 4,
  text: "Wednesday",
  note: "",
  color: "green",
  isEditing: false,
  noteType: "text",
  schedule: {
    mode: "every",
    amount: 1,
    unit: "weeks",
    startsAt: "2026-05-01T09:00:00.000Z",
    weekdays: [3],
    time: "09:00",
  },
};

const calendarToday = {
  id: 90,
  printedAt: "2026-05-18T14:30:00.000Z",
  todo: {
    id: 9,
    text: "Calendar today",
    note: "",
    color: "blue",
    isEditing: false,
    noteType: "text",
  },
};

const calendarTomorrow = {
  id: 91,
  printedAt: "2026-05-19T14:30:00.000Z",
  todo: {
    id: 10,
    text: "Calendar tomorrow",
    note: "",
    color: "blue",
    isEditing: false,
    noteType: "text",
  },
};

const trackedCalendarToday = {
  id: 92,
  printedAt: "2026-05-18T15:30:00.000Z",
  isTrackingEntry: true,
  todo: {
    id: 11,
    text: "Tracked calendar",
    note: "",
    color: "blue",
    isEditing: false,
    noteType: "text",
  },
};

assert.equal(getDayKey(monday), "2026-05-18");
assert.equal(isScheduleDueOnDay(archivedEveryDay.schedule, monday), true);
assert.equal(isScheduleDueOnDay(archivedEveryTwoDays.schedule, monday), true);
assert.equal(
  isScheduleDueOnDay(archivedWeeklyWednesday.schedule, monday),
  false,
);

const items = buildTodayItems({
  activeTodos: [activeTodo],
  archivedTodos: [
    archivedEveryDay,
    archivedEveryTwoDays,
    archivedWeeklyWednesday,
  ],
  calendarEntries: [calendarToday, calendarTomorrow, trackedCalendarToday],
  date: monday,
  dismissedOccurrenceKeys: [],
});

assert.deepEqual(
  items.map((item) => `${item.source.type}:${item.todo.text}`),
  [
    "active:Active",
    "archived-repeat:Daily archive",
    "archived-repeat:Every two",
    "calendar-instance:Calendar today",
  ],
);

const dismissedKey = getTodayOccurrenceKey({
  source: { type: "archived-repeat", todoId: 2 },
  date: monday,
});

const dismissedItems = buildTodayItems({
  activeTodos: [activeTodo],
  archivedTodos: [archivedEveryDay],
  calendarEntries: [calendarToday],
  date: monday,
  dismissedOccurrenceKeys: [dismissedKey],
});

assert.deepEqual(
  dismissedItems.map((item) => item.todo.text),
  ["Active", "Calendar today"],
);

console.log("today view tests passed");
