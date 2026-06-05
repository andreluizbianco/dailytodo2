import { CalendarEntry } from "../types";

export const detachCalendarEntryFromProject = (
  entries: CalendarEntry[],
  entryId: number,
) =>
  entries.map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          todo: {
            ...entry.todo,
            projectId: undefined,
          },
        }
      : entry,
  );
