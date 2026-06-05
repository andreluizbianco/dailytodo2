import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";
import { CalendarEntry, Todo } from "../types";
import { stripListSyntaxForText } from "./checklist";
import { normalizeReminder, normalizeSchedule } from "./schedule";

const REMINDER_IDS_KEY = "scheduledReminderIds";
const REMINDER_ID_PREFIX = "note-reminder-";

const { TimerModule } = NativeModules;

export const reconcileTodoReminders = async (todos: Todo[]) => {
  const previousIds = await loadScheduledReminderIds();
  await Promise.all(previousIds.map(cancelReminderNotification));

  const nextIds: string[] = [];

  for (const todo of todos) {
    const scheduledId = await scheduleTodoReminder(todo);
    if (scheduledId) {
      nextIds.push(scheduledId);
    }
  }

  await saveScheduledReminderIds(nextIds);
};

const scheduleTodoReminder = async (todo: Todo) => {
  const reminderAt = getReminderDate(todo);
  if (!reminderAt) return null;

  const identifier = getReminderNotificationId(todo.id);
  const title = todo.text.trim() || "Note reminder";
  const body =
    stripListSyntaxForText(todo.note).trim().replace(/\s+/g, " ") ||
    "Reminder for this note";
  const timerMode = todo.timerMode ?? "pomodoro";
  const durationSeconds =
    timerMode === "stopwatch" ? 0 : getTodoPomodoroDurationSeconds(todo);
  const timerText =
    timerMode === "stopwatch"
      ? "Stopwatch"
      : `${Math.max(1, Math.round(durationSeconds / 60))} min pomodoro`;

  if (Platform.OS === "android" && TimerModule?.scheduleReminder) {
    TimerModule.scheduleReminder(
      getNativeReminderId(identifier),
      reminderAt.getTime(),
      title,
      body,
      String(todo.id),
      timerMode,
      durationSeconds,
      timerText,
    );
  }

  return identifier;
};

export const createCalendarReminderTodo = (entry: CalendarEntry): Todo => {
  const entryDate = new Date(entry.printedAt);
  const time = `${String(entryDate.getHours()).padStart(2, "0")}:${String(
    entryDate.getMinutes(),
  ).padStart(2, "0")}`;

  return {
    ...entry.todo,
    id: -Math.abs(entry.id),
    schedule: {
      ...(entry.todo.schedule ?? {
        mode: "date",
        amount: 1,
        unit: "days",
      }),
      mode: "date",
      targetDate: entry.printedAt,
      time,
      nextAt: entry.printedAt,
    },
  };
};

const getReminderDate = (todo: Todo) => {
  if (!todo.schedule || !todo.reminder) return null;

  const schedule = normalizeSchedule(todo.schedule);
  const reminder = normalizeReminder(todo.reminder);
  const targetDate = schedule.nextAt ? new Date(schedule.nextAt) : null;

  if (!targetDate || Number.isNaN(targetDate.getTime())) return null;

  const reminderDate = new Date(targetDate);
  switch (reminder.unit) {
    case "minutes":
      reminderDate.setMinutes(reminderDate.getMinutes() - reminder.amount);
      break;
    case "hours":
      reminderDate.setHours(reminderDate.getHours() - reminder.amount);
      break;
    case "days":
      reminderDate.setDate(reminderDate.getDate() - reminder.amount);
      break;
  }

  if (reminderDate.getTime() <= Date.now()) return null;

  return reminderDate;
};

const getReminderNotificationId = (todoId: number) => {
  return `${REMINDER_ID_PREFIX}${todoId}`;
};

export const getTodoPomodoroDurationSeconds = (todo: Pick<Todo, "timer">) => {
  const hours = Number(todo.timer?.hours ?? "00");
  const minutes = Number(todo.timer?.minutes ?? "25");
  const totalMinutes =
    (Number.isFinite(hours) ? hours : 0) * 60 +
    (Number.isFinite(minutes) ? minutes : 25);

  return Math.max(60, totalMinutes * 60);
};

const cancelReminderNotification = async (identifier: string) => {
  try {
    if (Platform.OS === "android" && TimerModule?.cancelReminder) {
      TimerModule.cancelReminder(getNativeReminderId(identifier));
    }
  } catch (error) {
    console.warn("Failed to cancel reminder notification", error);
  }
};

const getNativeReminderId = (identifier: string) => {
  const numericId = Number(identifier.replace(REMINDER_ID_PREFIX, ""));
  if (!Number.isFinite(numericId)) return 0;

  return Math.abs(Math.trunc(numericId)) % 1_000_000_000;
};

const loadScheduledReminderIds = async () => {
  try {
    const savedIds = await AsyncStorage.getItem(REMINDER_IDS_KEY);
    const parsedIds = savedIds ? JSON.parse(savedIds) : [];
    return Array.isArray(parsedIds)
      ? parsedIds.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
};

const saveScheduledReminderIds = async (ids: string[]) => {
  await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(ids));
};
