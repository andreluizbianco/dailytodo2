import { ScheduleMode, ScheduleUnit, TodoSchedule } from "../types";

export const SCHEDULE_MODES: ScheduleMode[] = ["every", "in"];
export const SCHEDULE_UNITS: ScheduleUnit[] = [
  "days",
  "weeks",
  "months",
  "years",
];
export const WEEKDAYS = [
  { label: "M", value: 1 },
  { label: "T", value: 2 },
  { label: "W", value: 3 },
  { label: "T", value: 4 },
  { label: "F", value: 5 },
  { label: "S", value: 6 },
  { label: "S", value: 0 },
];

export const SCHEDULE_AMOUNT_MIN = 1;
export const SCHEDULE_AMOUNT_MAX = 365;

export const createDefaultSchedule = (): TodoSchedule => {
  const now = new Date().toISOString();

  return {
    mode: "every",
    amount: 1,
    unit: "days",
    time: createCurrentTimeString(),
    weekdays: WEEKDAYS.map((day) => day.value),
    startsAt: now,
    nextAt: calculateNextScheduleDate({
      mode: "every",
      amount: 1,
      unit: "days",
      time: createCurrentTimeString(),
      weekdays: WEEKDAYS.map((day) => day.value),
      startsAt: now,
    }),
  };
};

export const normalizeSchedule = (
  schedule?: Partial<TodoSchedule>,
): TodoSchedule => {
  const defaultSchedule = createDefaultSchedule();
  const nextSchedule: TodoSchedule = {
    ...defaultSchedule,
    ...schedule,
    mode: isScheduleMode(schedule?.mode) ? schedule.mode : defaultSchedule.mode,
    unit: isScheduleUnit(schedule?.unit) ? schedule.unit : defaultSchedule.unit,
    amount: clampScheduleAmount(schedule?.amount),
    time: normalizeScheduleTime(schedule?.time ?? defaultSchedule.time),
    weekdays: normalizeWeekdays(schedule?.weekdays),
  };

  return {
    ...nextSchedule,
    nextAt: calculateNextScheduleDate(nextSchedule),
  };
};

export const updateSchedule = (
  currentSchedule: TodoSchedule | undefined,
  updates: Partial<TodoSchedule>,
): TodoSchedule => {
  return normalizeSchedule({
    ...(currentSchedule ?? createDefaultSchedule()),
    ...updates,
  });
};

export const toggleScheduleWeekday = (
  schedule: TodoSchedule | undefined,
  weekday: number,
): TodoSchedule => {
  const currentSchedule = normalizeSchedule(schedule);
  const currentWeekdays = currentSchedule.weekdays ?? [];
  const hasWeekday = currentWeekdays.includes(weekday);
  const nextWeekdays = hasWeekday
    ? currentWeekdays.filter((day) => day !== weekday)
    : [...currentWeekdays, weekday];

  return updateSchedule(currentSchedule, {
    weekdays: normalizeWeekdays(nextWeekdays),
  });
};

const calculateNextScheduleDate = (schedule: TodoSchedule): string => {
  const baseDate = schedule.startsAt ? new Date(schedule.startsAt) : new Date();

  if (schedule.mode === "date" && schedule.targetDate) {
    return schedule.targetDate;
  }

  if (schedule.mode === "in") {
    return addScheduleInterval(baseDate, schedule.amount, schedule.unit);
  }

  return addScheduleInterval(baseDate, schedule.amount, schedule.unit);
};

const addScheduleInterval = (
  date: Date,
  amount: number,
  unit: ScheduleUnit,
): string => {
  const nextDate = new Date(date);

  switch (unit) {
    case "days":
      nextDate.setDate(nextDate.getDate() + amount);
      break;
    case "weeks":
      nextDate.setDate(nextDate.getDate() + amount * 7);
      break;
    case "months":
      nextDate.setMonth(nextDate.getMonth() + amount);
      break;
    case "years":
      nextDate.setFullYear(nextDate.getFullYear() + amount);
      break;
  }

  return nextDate.toISOString();
};

export const normalizeScheduleTime = (time?: string): string => {
  if (!time) return "09:00";

  const match = time.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return "09:00";

  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number(match[2])));

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const createCurrentTimeString = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
};

const normalizeWeekdays = (weekdays?: number[]) => {
  const validWeekdays = (weekdays ?? WEEKDAYS.map((day) => day.value))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .filter((day, index, days) => days.indexOf(day) === index);

  return validWeekdays.sort((a, b) => weekdayOrder(a) - weekdayOrder(b));
};

const weekdayOrder = (weekday: number) => (weekday === 0 ? 7 : weekday);

const clampScheduleAmount = (amount?: number) => {
  if (!Number.isFinite(amount)) return 1;

  return Math.max(
    SCHEDULE_AMOUNT_MIN,
    Math.min(SCHEDULE_AMOUNT_MAX, Math.round(Number(amount))),
  );
};

const isScheduleMode = (mode?: string): mode is ScheduleMode => {
  return mode === "every" || mode === "in" || mode === "date";
};

const isScheduleUnit = (unit?: string): unit is ScheduleUnit => {
  return (
    unit === "days" || unit === "weeks" || unit === "months" || unit === "years"
  );
};
