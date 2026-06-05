import {
  CalendarEntry,
  CalendarProjectionRange,
  Todo,
  TodoSchedule,
} from "../types";
import { isScheduleDueOnDay } from "./todayView";

export type CalendarProjectionSource =
  | { type: "todo"; todoId: number }
  | { type: "archive"; todoId: number }
  | { type: "calendar"; entryId: number };

export interface CalendarProjection {
  id: string;
  printedAt: string;
  source: CalendarProjectionSource;
  todo: Todo;
}

interface BuildCalendarProjectionsInput {
  archivedTodos: Todo[];
  calendarEntries: CalendarEntry[];
  range: CalendarProjectionRange;
  todos: Todo[];
}

const rangeMonths: Partial<Record<CalendarProjectionRange, number>> = {
  "3m": 3,
  "6m": 6,
};

export const buildCalendarProjections = ({
  archivedTodos,
  calendarEntries,
  range,
  todos,
}: BuildCalendarProjectionsInput): CalendarProjection[] => {
  if (range === "off") return [];

  const startDate = startOfLocalDay(new Date());
  const endDate = new Date(startDate);
  if (range === "1w") {
    endDate.setDate(endDate.getDate() + 7);
  } else {
    endDate.setMonth(endDate.getMonth() + (rangeMonths[range] ?? 3));
  }

  const realEntryKeys = new Set(
    calendarEntries.map(
      (entry) => `${entry.todo.id}:${getLocalDateKey(new Date(entry.printedAt))}`,
    ),
  );

  const projections: CalendarProjection[] = [];
  const scheduledTodos: Array<{
    source: CalendarProjectionSource;
    todo: Todo;
  }> = [
    ...todos.map((todo) => ({
      todo,
      source: { type: "todo" as const, todoId: todo.id },
    })),
    ...archivedTodos.map((todo) => ({
      todo,
      source: { type: "archive" as const, todoId: todo.id },
    })),
    ...calendarEntries.map((entry) => ({
      todo: entry.todo,
      source: { type: "calendar" as const, entryId: entry.id },
    })),
  ].filter(({ todo }) => Boolean(todo.schedule));

  scheduledTodos.forEach(({ source, todo }) => {
    const schedule = todo.schedule;
    if (!schedule) return;

    if (schedule.mode === "in" || schedule.mode === "date") {
      const projectedDate = getSingleProjectionDate(schedule);
      if (
        projectedDate &&
        projectedDate.getTime() >= startDate.getTime() &&
        projectedDate.getTime() <= endDate.getTime()
      ) {
        addProjection(projections, realEntryKeys, todo, source, projectedDate);
      }
      return;
    }

    for (
      let cursor = new Date(startDate);
      cursor.getTime() <= endDate.getTime();
      cursor.setDate(cursor.getDate() + 1)
    ) {
      if (!isScheduleDueOnDay(schedule, cursor)) continue;
      addProjection(projections, realEntryKeys, todo, source, cursor);
    }
  });

  return projections.sort(
    (left, right) =>
      new Date(left.printedAt).getTime() - new Date(right.printedAt).getTime(),
  );
};

const addProjection = (
  projections: CalendarProjection[],
  realEntryKeys: Set<string>,
  todo: Todo,
  source: CalendarProjectionSource,
  date: Date,
) => {
  const projectedAt = applyScheduleTime(date, todo.schedule);
  const dayKey = getLocalDateKey(projectedAt);
  const realEntryKey = `${todo.id}:${dayKey}`;
  if (realEntryKeys.has(realEntryKey)) return;

  projections.push({
    id: `${source.type}:${"todoId" in source ? source.todoId : source.entryId}:${dayKey}`,
    printedAt: projectedAt.toISOString(),
    source,
    todo,
  });
};

const getSingleProjectionDate = (schedule: TodoSchedule) => {
  if (schedule.mode === "date" && schedule.targetDate) {
    return new Date(schedule.targetDate);
  }

  if (schedule.nextAt) {
    return new Date(schedule.nextAt);
  }

  return null;
};

const applyScheduleTime = (date: Date, schedule?: TodoSchedule) => {
  const nextDate = new Date(date);
  const [hours, minutes] = (schedule?.time ?? "09:00").split(":").map(Number);
  nextDate.setHours(
    Number.isFinite(hours) ? hours : 9,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  );
  return nextDate;
};

const startOfLocalDay = (date: Date) => {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const getLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
