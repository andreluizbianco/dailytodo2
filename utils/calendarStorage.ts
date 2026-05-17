import AsyncStorage from "@react-native-async-storage/async-storage";
import { CalendarEntry, Todo } from "../types";

interface AddTimerEntryParams {
  todo: Todo;
  completed: boolean;
  startedAt: number;
  printedAt?: string;
  plannedMinutes?: number;
  elapsedSeconds?: number;
}

export const addTimerEntryToCalendar = async ({
  todo,
  completed,
  startedAt,
  printedAt,
  plannedMinutes,
  elapsedSeconds,
}: AddTimerEntryParams): Promise<CalendarEntry | null> => {
  const now = Date.now();
  const elapsedMs = now - startedAt;

  const elapsedMinutes =
    typeof elapsedSeconds === "number"
      ? Math.max(1, Math.round(elapsedSeconds / 60))
      : completed && typeof plannedMinutes === "number"
        ? plannedMinutes
        : Math.max(1, Math.round(elapsedMs / (1000 * 60)));

  try {
    const savedData = await AsyncStorage.getItem("todosData");
    let currentTodo = todo;

    if (savedData) {
      const { todos } = JSON.parse(savedData);
      const latestTodo = todos.find((t: Todo) => t.id === todo.id);

      if (latestTodo) {
        currentTodo = latestTodo;
      }
    }

    const calendarEntry: CalendarEntry = {
      id: now,
      todo: { ...currentTodo, projectId: undefined },
      printedAt: printedAt ?? new Date(startedAt).toISOString(),
      timerCompleted: completed,
      isTrackingEntry: true,
      timeSpent: {
        elapsed: elapsedMinutes,
      },
    };

    const savedEntries = await AsyncStorage.getItem("calendarEntries");
    const currentEntries: CalendarEntry[] = savedEntries
      ? JSON.parse(savedEntries)
      : [];

    const alreadyExists = currentEntries.some((entry) => {
      return (
        Number(entry.todo.id) === Number(calendarEntry.todo.id) &&
        entry.printedAt === calendarEntry.printedAt &&
        entry.timerCompleted === calendarEntry.timerCompleted &&
        entry.timeSpent?.elapsed === calendarEntry.timeSpent?.elapsed
      );
    });

    if (alreadyExists) {
      return null;
    }

    const updatedEntries = [...currentEntries, calendarEntry];

    await AsyncStorage.setItem(
      "calendarEntries",
      JSON.stringify(updatedEntries),
    );

    return calendarEntry;
  } catch (error) {
    console.error("Error adding timer entry to calendar:", error);
    return null;
  }
};

export const replaceCalendarEntry = (
  entries: CalendarEntry[],
  entryId: number,
  replacement: CalendarEntry,
) => {
  return entries.map((entry) => (entry.id === entryId ? replacement : entry));
};
