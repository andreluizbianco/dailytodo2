import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";
import { CalendarEntry, Todo } from "../types";
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
  const body = todo.note.trim() || "Reminder for this note";

  if (Platform.OS === "android" && TimerModule?.scheduleReminder) {
    TimerModule.scheduleReminder(
      getNativeReminderId(identifier),
      reminderAt.getTime(),
      title,
      body,
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
