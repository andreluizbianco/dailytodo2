# Daily View Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the main Notes view a computed Today view that shows active notes, due recurring archived notes, and today's calendar notes without duplicating underlying data.

**Architecture:** Add pure date/source helpers in `utils/todayView.ts`, add occurrence dismissal persistence in `utils/todayDismissals.ts`, then wire `App.tsx` and `TodoNoteColumn.tsx` to carry source metadata through selection, archive, timer completion, and calendar printing. Keep the existing archive/calendar/project stores intact; Today is a projection.

**Tech Stack:** React Native, Expo, TypeScript, AsyncStorage, existing Node assertion tests transpiling TypeScript with `typescript.transpileModule`.

---

## File Structure

- Create `utils/todayView.ts`: pure helpers for day keys, occurrence keys, schedule matching, and building Today items from active/archive/calendar.
- Create `utils/todayDismissals.ts`: AsyncStorage-backed dismissed occurrence keys for items hidden from Today for one day.
- Create `tests/todayView.test.js`: unit tests for repeat rules, calendar-origin items, and dismissal filtering.
- Modify `types.ts`: add Today source types and optional `dismissedOccurrences` export types if needed.
- Modify `App.tsx`: compute Today items, preserve source during selection, route archive/print/timer-completion actions by source.
- Modify `components/TodoNoteColumn.tsx`: accept projected Today rows while still rendering existing `TodoList`.
- Modify `utils/calendarStorage.ts`: add/update helper for replacing calendar-origin entries on completion.
- Modify `utils/reminders.ts`: keep reminders based on stored notes/calendar, not Today projection.

---

### Task 1: Add Today View Pure Helpers

**Files:**
- Create: `utils/todayView.ts`
- Test: `tests/todayView.test.js`
- Modify: `types.ts`

- [ ] **Step 1: Add failing tests for Today projection**

Create `tests/todayView.test.js`:

```js
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

assert.equal(getDayKey(monday), "2026-05-18");
assert.equal(isScheduleDueOnDay(archivedEveryDay.schedule, monday), true);
assert.equal(isScheduleDueOnDay(archivedEveryTwoDays.schedule, monday), true);
assert.equal(isScheduleDueOnDay(archivedWeeklyWednesday.schedule, monday), false);

const items = buildTodayItems({
  activeTodos: [activeTodo],
  archivedTodos: [archivedEveryDay, archivedEveryTwoDays, archivedWeeklyWednesday],
  calendarEntries: [calendarToday, calendarTomorrow],
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/todayView.test.js`

Expected: FAIL with a module-not-found error for `utils/todayView.ts`.

- [ ] **Step 3: Add Today types**

Modify `types.ts` by adding these exports after `CalendarEntry`:

```ts
export type TodayTodoSource =
  | { type: "active"; todoId: number }
  | { type: "archived-repeat"; todoId: number }
  | { type: "calendar-instance"; entryId: number; todoId: number };

export interface TodayTodoItem {
  todo: Todo;
  source: TodayTodoSource;
  occurrenceKey: string;
}
```

- [ ] **Step 4: Implement pure helper**

Create `utils/todayView.ts`:

```ts
import { CalendarEntry, Todo, TodayTodoItem, TodayTodoSource, TodoSchedule } from "../types";

interface BuildTodayItemsInput {
  activeTodos: Todo[];
  archivedTodos: Todo[];
  calendarEntries: CalendarEntry[];
  date: Date;
  dismissedOccurrenceKeys: string[];
}

export const getDayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getTodayOccurrenceKey = ({
  source,
  date,
}: {
  source: TodayTodoSource;
  date: Date;
}) => {
  const id =
    source.type === "calendar-instance"
      ? `calendar-${source.entryId}`
      : `${source.type}-${source.todoId}`;
  return `${getDayKey(date)}:${id}`;
};

export const buildTodayItems = ({
  activeTodos,
  archivedTodos,
  calendarEntries,
  date,
  dismissedOccurrenceKeys,
}: BuildTodayItemsInput): TodayTodoItem[] => {
  const dismissed = new Set(dismissedOccurrenceKeys);
  const todayItems: TodayTodoItem[] = [];

  for (const todo of activeTodos) {
    todayItems.push(createItem(todo, { type: "active", todoId: todo.id }, date));
  }

  for (const todo of archivedTodos) {
    if (!todo.schedule || !isScheduleDueOnDay(todo.schedule, date)) continue;
    const item = createItem(todo, { type: "archived-repeat", todoId: todo.id }, date);
    if (!dismissed.has(item.occurrenceKey)) todayItems.push(item);
  }

  for (const entry of calendarEntries) {
    if (!isSameLocalDay(new Date(entry.printedAt), date)) continue;
    const item = createItem(
      entry.todo,
      { type: "calendar-instance", entryId: entry.id, todoId: entry.todo.id },
      date,
    );
    if (!dismissed.has(item.occurrenceKey)) todayItems.push(item);
  }

  return todayItems;
};

export const isScheduleDueOnDay = (schedule: TodoSchedule, date: Date) => {
  if (schedule.mode === "date") {
    return Boolean(schedule.targetDate) && isSameLocalDay(new Date(schedule.targetDate), date);
  }

  const start = schedule.startsAt ? new Date(schedule.startsAt) : new Date();
  if (Number.isNaN(start.getTime())) return false;

  if (schedule.mode === "in") {
    return isSameLocalDay(addInterval(start, schedule.amount, schedule.unit), date);
  }

  if (startOfLocalDay(date).getTime() < startOfLocalDay(start).getTime()) return false;

  if (schedule.unit === "days") {
    return daysBetween(start, date) % schedule.amount === 0;
  }

  if (schedule.unit === "weeks") {
    const weekdays = schedule.weekdays ?? [];
    if (weekdays.length > 0 && !weekdays.includes(date.getDay())) return false;
    return Math.floor(daysBetween(start, date) / 7) % schedule.amount === 0;
  }

  if (schedule.unit === "months") {
    return date.getDate() === start.getDate() && monthsBetween(start, date) % schedule.amount === 0;
  }

  return (
    date.getDate() === start.getDate() &&
    date.getMonth() === start.getMonth() &&
    (date.getFullYear() - start.getFullYear()) % schedule.amount === 0
  );
};

const createItem = (todo: Todo, source: TodayTodoSource, date: Date): TodayTodoItem => ({
  todo: { ...todo, isEditing: false },
  source,
  occurrenceKey: getTodayOccurrenceKey({ source, date }),
});

const isSameLocalDay = (left: Date, right: Date) => {
  return getDayKey(left) === getDayKey(right);
};

const startOfLocalDay = (date: Date) => {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const daysBetween = (start: Date, end: Date) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((startOfLocalDay(end).getTime() - startOfLocalDay(start).getTime()) / msPerDay);
};

const monthsBetween = (start: Date, end: Date) => {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
};

const addInterval = (date: Date, amount: number, unit: TodoSchedule["unit"]) => {
  const nextDate = new Date(date);
  if (unit === "days") nextDate.setDate(nextDate.getDate() + amount);
  if (unit === "weeks") nextDate.setDate(nextDate.getDate() + amount * 7);
  if (unit === "months") nextDate.setMonth(nextDate.getMonth() + amount);
  if (unit === "years") nextDate.setFullYear(nextDate.getFullYear() + amount);
  return nextDate;
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node tests/todayView.test.js`

Expected: PASS and prints `today view tests passed`.

- [ ] **Step 6: Commit**

```bash
git add types.ts utils/todayView.ts tests/todayView.test.js
git commit -m "feat: add today view schedule helpers"
```

---

### Task 2: Persist Today Occurrence Dismissals

**Files:**
- Create: `utils/todayDismissals.ts`
- Test: `tests/todayDismissals.test.js`

- [ ] **Step 1: Add failing storage tests**

Create `tests/todayDismissals.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/todayDismissals.test.js`

Expected: FAIL with module-not-found for `utils/todayDismissals.ts`.

- [ ] **Step 3: Implement dismissal persistence**

Create `utils/todayDismissals.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const DISMISSED_TODAY_OCCURRENCES_KEY = "dismissedTodayOccurrences";

export const loadDismissedTodayOccurrences = async (dayKey: string) => {
  const allKeys = await loadAllDismissedOccurrences();
  return allKeys.filter((key) => key.startsWith(`${dayKey}:`));
};

export const dismissTodayOccurrence = async (occurrenceKey: string) => {
  const allKeys = await loadAllDismissedOccurrences();
  const dayPrefix = occurrenceKey.split(":")[0];
  const nextKeys = Array.from(
    new Set([
      ...allKeys.filter((key) => key.startsWith(`${dayPrefix}:`)),
      occurrenceKey,
    ]),
  );
  await AsyncStorage.setItem(
    DISMISSED_TODAY_OCCURRENCES_KEY,
    JSON.stringify(nextKeys),
  );
  return nextKeys;
};

const loadAllDismissedOccurrences = async () => {
  try {
    const saved = await AsyncStorage.getItem(DISMISSED_TODAY_OCCURRENCES_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === "string")
      : [];
  } catch {
    return [];
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/todayDismissals.test.js`

Expected: PASS and prints `today dismissal tests passed`.

- [ ] **Step 5: Commit**

```bash
git add utils/todayDismissals.ts tests/todayDismissals.test.js
git commit -m "feat: persist dismissed today occurrences"
```

---

### Task 3: Wire Today Projection Into Notes View

**Files:**
- Modify: `App.tsx`
- Modify: `components/TodoNoteColumn.tsx`

- [ ] **Step 1: Add state and computed Today items in `App.tsx`**

Add imports:

```ts
import {
  buildTodayItems,
  getDayKey,
  getTodayOccurrenceKey,
} from "./utils/todayView";
import {
  dismissTodayOccurrence,
  loadDismissedTodayOccurrences,
} from "./utils/todayDismissals";
import { TodayTodoItem, TodayTodoSource } from "./types";
```

Add state near existing app state:

```ts
const [todayDate, setTodayDate] = useState(() => new Date());
const [dismissedTodayKeys, setDismissedTodayKeys] = useState<string[]>([]);
const [selectedTodaySource, setSelectedTodaySource] =
  useState<TodayTodoSource | null>(null);
```

Add effects:

```ts
useEffect(() => {
  const loadDismissals = async () => {
    setDismissedTodayKeys(await loadDismissedTodayOccurrences(getDayKey(todayDate)));
  };
  loadDismissals();
}, [todayDate]);

useEffect(() => {
  const timer = setInterval(() => {
    setTodayDate((current) => {
      const now = new Date();
      return getDayKey(now) === getDayKey(current) ? current : now;
    });
  }, 60_000);

  return () => clearInterval(timer);
}, []);

const todayItems = useMemo(
  () =>
    buildTodayItems({
      activeTodos: todos,
      archivedTodos,
      calendarEntries,
      date: todayDate,
      dismissedOccurrenceKeys: dismissedTodayKeys,
    }),
  [archivedTodos, calendarEntries, dismissedTodayKeys, todayDate, todos],
);
```

- [ ] **Step 2: Add source-aware selection helper in `App.tsx`**

Add:

```ts
const handleSelectTodayItem = (item: TodayTodoItem) => {
  setSelectedTodo(item.todo);
  setSelectedTodaySource(item.source);
  setShowSettings(false);
};
```

When selecting a normal note outside Notes/Today, clear `selectedTodaySource`:

```ts
setSelectedTodaySource(null);
```

- [ ] **Step 3: Pass Today items to `TodoNoteColumn`**

Update the `TodoNoteColumn` call for `activeView === "notes"`:

```tsx
<TodoNoteColumn
  todayItems={activeView === "notes" ? todayItems : undefined}
  selectedTodaySource={selectedTodaySource}
  onSelectTodayItem={handleSelectTodayItem}
  ...
/>
```

- [ ] **Step 4: Render Today items in `TodoNoteColumn.tsx`**

Add props:

```ts
todayItems?: TodayTodoItem[];
selectedTodaySource?: TodayTodoSource | null;
onSelectTodayItem?: (item: TodayTodoItem) => void;
```

Inside the Notes list branch, derive:

```ts
const visibleTodos = todayItems?.map((item) => item.todo) ?? todos;
```

Pass `visibleTodos` to `TodoList`. In the item selection callback, if `todayItems` exists, find the matching item:

```ts
const todayItem = todayItems?.find((item) => item.todo.id === todo.id);
if (todayItem && onSelectTodayItem) {
  onSelectTodayItem(todayItem);
  return;
}
selectTodo(todo);
```

- [ ] **Step 5: Verify TypeScript**

Run: `npx tsc --noEmit`

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Manual smoke test**

Run: `npx expo start`

Expected:

- active notes still appear in Notes view;
- archived note with `Repeat every day` appears in Notes view;
- future calendar note appears only on its calendar day.

- [ ] **Step 7: Commit**

```bash
git add App.tsx components/TodoNoteColumn.tsx
git commit -m "feat: show scheduled notes in today view"
```

---

### Task 4: Make Archive and Dismiss Actions Source-Aware

**Files:**
- Modify: `App.tsx`
- Modify: `components/TodoNoteColumn.tsx`

- [ ] **Step 1: Add source-aware dismissal handler in `App.tsx`**

Add:

```ts
const dismissSelectedTodayOccurrence = async () => {
  if (!selectedTodaySource) return false;

  const occurrenceKey = getTodayOccurrenceKey({
    source: selectedTodaySource,
    date: todayDate,
  });
  const nextKeys = await dismissTodayOccurrence(occurrenceKey);
  setDismissedTodayKeys(nextKeys);
  setSelectedTodo(null);
  setSelectedTodaySource(null);
  return true;
};
```

- [ ] **Step 2: Update archive action**

Where archive is triggered from Notes settings:

```ts
if (selectedTodaySource?.type === "archived-repeat") {
  dismissSelectedTodayOccurrence();
  return;
}

if (selectedTodaySource?.type === "calendar-instance") {
  dismissSelectedTodayOccurrence();
  return;
}

archiveTodo(selectedTodo.id);
```

- [ ] **Step 3: Verify no archive duplicates**

Manual scenario:

- create a note with Repeat every day;
- archive it;
- confirm it appears in Notes today;
- use archive action on that visible item;
- open Archive and confirm the note appears exactly once.

- [ ] **Step 4: Commit**

```bash
git add App.tsx components/TodoNoteColumn.tsx
git commit -m "fix: dismiss today occurrences without archive duplicates"
```

---

### Task 5: Source-Aware Calendar Recording

**Files:**
- Modify: `utils/calendarStorage.ts`
- Modify: `App.tsx`
- Test: `tests/calendarStorageToday.test.js`

- [ ] **Step 1: Add failing helper test**

Create `tests/calendarStorageToday.test.js`:

```js
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

const { replaceCalendarEntry } = require(path.join(
  __dirname,
  "..",
  "utils",
  "calendarStorage.ts",
));

const entries = [
  {
    id: 10,
    printedAt: "2026-05-18T09:00:00.000Z",
    todo: { id: 5, text: "Original", note: "", color: "blue", isEditing: false, noteType: "text" },
  },
];

const nextEntries = replaceCalendarEntry(entries, 10, {
  id: 10,
  printedAt: "2026-05-18T10:30:00.000Z",
  todo: { id: 5, text: "Original", note: "done", color: "blue", isEditing: false, noteType: "text" },
  timerCompleted: true,
  timeSpent: { elapsed: 25 },
});

assert.equal(nextEntries.length, 1);
assert.equal(nextEntries[0].printedAt, "2026-05-18T10:30:00.000Z");
assert.equal(nextEntries[0].timerCompleted, true);

console.log("calendar storage today tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/calendarStorageToday.test.js`

Expected: FAIL because `replaceCalendarEntry` is not exported.

- [ ] **Step 3: Add calendar replace helper**

Add to `utils/calendarStorage.ts`:

```ts
export const replaceCalendarEntry = (
  entries: CalendarEntry[],
  entryId: number,
  replacement: CalendarEntry,
) => {
  return entries.map((entry) => (entry.id === entryId ? replacement : entry));
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/calendarStorageToday.test.js`

Expected: PASS and prints `calendar storage today tests passed`.

- [ ] **Step 5: Update timer completion in `App.tsx`**

When handling timer completion:

```ts
if (selectedTodaySource?.type === "calendar-instance") {
  const completedEntry: CalendarEntry = {
    id: selectedTodaySource.entryId,
    todo: { ...completedTodo, projectId: undefined },
    printedAt: new Date().toISOString(),
    timerCompleted: true,
    timeSpent: { elapsed },
  };
  const updatedEntries = replaceCalendarEntry(
    calendarEntriesRef.current,
    selectedTodaySource.entryId,
    completedEntry,
  );
  setCalendarEntries(updatedEntries);
  await AsyncStorage.setItem("calendarEntries", JSON.stringify(updatedEntries));
  await dismissSelectedTodayOccurrence();
  return;
}
```

For `archived-repeat`, create a new calendar entry and then call `dismissSelectedTodayOccurrence()` instead of archiving the original note.

For `active`, keep the current behavior: create a calendar entry and archive the original note.

- [ ] **Step 6: Update manual print in `App.tsx`**

Apply the same source-aware branching to long press print:

```ts
if (selectedTodaySource?.type === "calendar-instance") {
  replace the existing calendar entry;
} else {
  create a new calendar entry;
}
```

- [ ] **Step 7: Verify TypeScript**

Run: `npx tsc --noEmit`

Expected: PASS with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add App.tsx utils/calendarStorage.ts tests/calendarStorageToday.test.js
git commit -m "feat: record today items without calendar duplicates"
```

---

### Task 6: Keep Reminders and Projects Stable

**Files:**
- Modify: `App.tsx`
- Modify: `utils/reminders.ts` only if reminders are accidentally based on Today items

- [ ] **Step 1: Inspect reminder reconciliation input**

Ensure `reconcileTodoReminders` receives stored notes:

```ts
const reminderTodos = [
  ...todos,
  ...archivedTodos,
  ...calendarEntries.map(createCalendarReminderTodo),
];
```

Do not pass `todayItems.map((item) => item.todo)` to reminder reconciliation.

- [ ] **Step 2: Confirm project membership survives Today projection**

In `buildTodayItems`, keep `todo.projectId` unchanged on projected items:

```ts
todo: { ...todo, isEditing: false }
```

In calendar tracking copies, keep the existing project reset:

```ts
todo: { ...completedTodo, projectId: undefined }
```

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add App.tsx utils/reminders.ts utils/todayView.ts
git commit -m "fix: keep reminders and projects stable in today view"
```

---

### Task 7: Full Verification

**Files:**
- No planned code changes.

- [ ] **Step 1: Run all helper tests touched by this feature**

Run:

```bash
node tests/todayView.test.js
node tests/todayDismissals.test.js
node tests/calendarStorageToday.test.js
node tests/calendarEntryActions.test.js
```

Expected: all tests print their `passed` messages.

- [ ] **Step 2: Run TypeScript**

Run: `npx tsc --noEmit`

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Compile Android Kotlin if timer/calendar native code was touched in the same implementation session**

Run from `android`:

```bash
.\gradlew.bat :app:compileDebugKotlin
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Manual Android scenarios**

Run the app with the user's normal workflow:

```bash
npx expo run:android --variant release
```

Expected:

- archived `Repeat every day` note appears in Notes today;
- rearchiving it hides it today and does not duplicate archive;
- tomorrow or a changed date calculation would make it eligible again;
- calendar note for today appears in Notes;
- completing a timer on the calendar-origin item updates the calendar entry instead of duplicating it;
- completing a timer on archived recurring note creates a new calendar tracking entry and keeps the original note archived;
- completing a timer on an active note creates a calendar entry and archives the original.

---

## Self-Review

Spec coverage:

- Today computed view: Task 1 and Task 3.
- Repeat rules: Task 1.
- Calendar-origin update instead of duplication: Task 5.
- Archive re-dismiss without duplication: Task 2 and Task 4.
- Day rollover: Task 3 interval and startup dismissal load.
- Projects/reminders stability: Task 6.
- Testing focus: Task 1, Task 2, Task 5, Task 7.

Placeholder scan:

- No unresolved placeholders are intentionally left in this plan.

Type consistency:

- `TodayTodoSource`, `TodayTodoItem`, `CalendarEntry`, `Todo`, and `TodoSchedule` names match existing or newly planned exports.

