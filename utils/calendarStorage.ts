import AsyncStorage from "@react-native-async-storage/async-storage";
import { CalendarEntry, Todo } from "../types";

interface AddTimerEntryParams {
  todo: Todo;
  completed: boolean;
  startedAt: number;
  printedAt?: string;
  plannedMinutes?: number;
}

export const addTimerEntryToCalendar = async ({
  todo,
  completed,
  startedAt,
  printedAt,
  plannedMinutes,
}: AddTimerEntryParams): Promise<CalendarEntry | null> => {
    const now = Date.now();
    const elapsedMs = now - startedAt;

    const elapsedMinutes =
    completed && typeof plannedMinutes === 'number'
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
      todo: { ...currentTodo },
      printedAt: printedAt ?? new Date(now).toISOString(),
      timerCompleted: completed,
      timeSpent: {
        elapsed: elapsedMinutes,
      },
    };

    const savedEntries = await AsyncStorage.getItem("calendarEntries");
    const currentEntries: CalendarEntry[] = savedEntries
      ? JSON.parse(savedEntries)
      : [];
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
