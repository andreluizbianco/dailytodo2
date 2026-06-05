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
  getProjectTodoRowKey,
  isSameProjectTodoId,
  isSameProjectTodoSource,
  shouldShowCalendarEntryInProject,
} = require(path.join(__dirname, "..", "utils", "projects.ts"));

assert.equal(
  isSameProjectTodoSource({ type: "todo" }, { type: "archive" }),
  true,
);
assert.equal(
  isSameProjectTodoSource(
    { type: "calendar", entryId: 1 },
    { type: "calendar", entryId: 1 },
  ),
  true,
);
assert.equal(
  isSameProjectTodoSource(
    { type: "calendar", entryId: 1 },
    { type: "calendar", entryId: 2 },
  ),
  false,
);
assert.equal(
  isSameProjectTodoSource({ type: "calendar", entryId: 1 }, { type: "archive" }),
  false,
);
assert.equal(isSameProjectTodoId(123, "123"), true);
assert.equal(isSameProjectTodoId(123, "124"), false);
assert.equal(isSameProjectTodoId(null, 123), false);
assert.equal(
  getProjectTodoRowKey({
    todo: { id: 123, projectId: 4, createdAt: "2026-06-04T10:00:00.000Z" },
    source: { type: "archive" },
    occurrenceIndex: 2,
  }),
  "archive-123-4-2026-06-04T10:00:00.000Z-2",
);
assert.notEqual(
  getProjectTodoRowKey({
    todo: { id: 123, projectId: 4 },
    source: { type: "archive" },
    occurrenceIndex: 0,
  }),
  getProjectTodoRowKey({
    todo: { id: 123, projectId: 4 },
    source: { type: "archive" },
    occurrenceIndex: 1,
  }),
  "old project notes without createdAt still need unique row keys",
);
assert.equal(
  getProjectTodoRowKey({
    todo: { id: 123, projectId: 4 },
    source: { type: "calendar", entryId: 55 },
  }),
  "calendar-55",
);
assert.equal(
  shouldShowCalendarEntryInProject(
    {
      id: 1,
      todo: { id: 123, projectId: 4 },
      printedAt: "2026-06-04T10:00:00.000Z",
    },
    4,
  ),
  true,
  "manual calendar entries assigned to a project should appear in Projects",
);
assert.equal(
  shouldShowCalendarEntryInProject(
    {
      id: 2,
      todo: { id: 123, projectId: 4 },
      printedAt: "2026-06-04T10:00:00.000Z",
      isTrackingEntry: true,
    },
    4,
  ),
  false,
  "printed/tracking calendar logs should not appear as project child notes",
);
assert.equal(
  shouldShowCalendarEntryInProject(
    {
      id: 3,
      todo: { id: 123, projectId: 4 },
      printedAt: "2026-06-04T10:00:00.000Z",
      timeSpent: { elapsed: 25 },
    },
    4,
  ),
  false,
  "timer logs should not appear as project child notes",
);

console.log("project tests passed");
