import {
  CalendarEntry,
  Todo,
  TodayTodoItem,
  TodayTodoSource,
  TodoSchedule,
} from "../types";

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

    const item = createItem(
      todo,
      { type: "archived-repeat", todoId: todo.id },
      date,
    );

    if (!dismissed.has(item.occurrenceKey)) {
      todayItems.push(item);
    }
  }

  for (const entry of calendarEntries) {
    if (entry.isTrackingEntry || entry.timerCompleted || entry.timeSpent) {
      continue;
    }

    if (!isSameLocalDay(new Date(entry.printedAt), date)) continue;

    const item = createItem(
      entry.todo,
      {
        type: "calendar-instance",
        entryId: entry.id,
        todoId: entry.todo.id,
      },
      date,
    );

    if (!dismissed.has(item.occurrenceKey)) {
      todayItems.push(item);
    }
  }

  return todayItems;
};

export const isScheduleDueOnDay = (schedule: TodoSchedule, date: Date) => {
  if (schedule.mode === "date") {
    return (
      Boolean(schedule.targetDate) &&
      isSameLocalDay(new Date(schedule.targetDate as string), date)
    );
  }

  const start = schedule.startsAt ? new Date(schedule.startsAt) : new Date();
  if (Number.isNaN(start.getTime())) return false;

  if (schedule.mode === "in") {
    return isSameLocalDay(
      addInterval(start, schedule.amount, schedule.unit),
      date,
    );
  }

  if (startOfLocalDay(date).getTime() < startOfLocalDay(start).getTime()) {
    return false;
  }

  if (schedule.unit === "days") {
    return daysBetween(start, date) % schedule.amount === 0;
  }

  if (schedule.unit === "weeks") {
    const weekdays = schedule.weekdays ?? [];
    if (weekdays.length > 0 && !weekdays.includes(date.getDay())) {
      return false;
    }
    return Math.floor(daysBetween(start, date) / 7) % schedule.amount === 0;
  }

  if (schedule.unit === "months") {
    return (
      date.getDate() === start.getDate() &&
      monthsBetween(start, date) % schedule.amount === 0
    );
  }

  return (
    date.getDate() === start.getDate() &&
    date.getMonth() === start.getMonth() &&
    (date.getFullYear() - start.getFullYear()) % schedule.amount === 0
  );
};

const createItem = (
  todo: Todo,
  source: TodayTodoSource,
  date: Date,
): TodayTodoItem => ({
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
  return Math.floor(
    (startOfLocalDay(end).getTime() - startOfLocalDay(start).getTime()) /
      msPerDay,
  );
};

const monthsBetween = (start: Date, end: Date) => {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    end.getMonth() -
    start.getMonth()
  );
};

const addInterval = (
  date: Date,
  amount: number,
  unit: TodoSchedule["unit"],
) => {
  const nextDate = new Date(date);

  if (unit === "days") nextDate.setDate(nextDate.getDate() + amount);
  if (unit === "weeks") nextDate.setDate(nextDate.getDate() + amount * 7);
  if (unit === "months") nextDate.setMonth(nextDate.getMonth() + amount);
  if (unit === "years") nextDate.setFullYear(nextDate.getFullYear() + amount);

  return nextDate;
};
