export const getCalendarAutoScrollKey = ({
  dayTimelineMode,
  selectedDate,
  viewMode,
}: {
  dayTimelineMode: boolean;
  entriesVersion?: number;
  selectedDate: string | null;
  viewMode: "day" | "week";
}) => {
  return `${viewMode}:${selectedDate ?? "none"}:${
    dayTimelineMode ? "timeline" : "list"
  }`;
};
