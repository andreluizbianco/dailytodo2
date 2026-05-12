import { CalendarEntry, Todo } from "../types";

export const createTodoCopyFromCalendarEntry = (
  entry: CalendarEntry,
  id: number,
  timestamp: string,
): Todo => ({
  ...entry.todo,
  id,
  isEditing: false,
  createdAt: timestamp,
  restoredFrom: {
    type: "calendar",
    originalId: entry.id,
    timestamp,
  },
});
