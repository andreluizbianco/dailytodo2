export type ArchiveActionView =
  | "notes"
  | "projects"
  | "timer"
  | "settings"
  | "archive"
  | "calendar";

export type ArchiveActionSource =
  | { type: "todo" }
  | { type: "archive" }
  | { type: "calendar"; entryId: number };

export type ArchiveAction = "archive" | "unarchive" | "none";

export const getArchiveActionForSelection = (
  activeView: ArchiveActionView,
  source: ArchiveActionSource,
): ArchiveAction => {
  if (source.type === "calendar") return "none";

  if (source.type === "archive") {
    return activeView === "notes" ? "archive" : "unarchive";
  }

  return "archive";
};

export const shouldUnarchiveSelection = (
  activeView: ArchiveActionView,
  source: ArchiveActionSource,
) => source.type === "archive" && activeView !== "notes";
