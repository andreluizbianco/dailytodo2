import { CalendarEntry, Project } from "../types";

export type ProjectTodoSource =
  | { type: "todo" }
  | { type: "archive" }
  | { type: "calendar"; entryId: number };

type ProjectTodoRowLike = {
  todo: {
    id: string | number;
    projectId?: number;
    createdAt?: string;
  };
  source: ProjectTodoSource;
  occurrenceIndex?: number;
};

export const getProjectDisplayName = (
  project: Project,
  projects: Project[],
) => {
  const title = project.title || "Untitled";
  if (!project.parentProjectId) return title;

  const parent = projects.find((item) => item.id === project.parentProjectId);
  return `${parent?.title || "Untitled"} / ${title}`;
};

export const getProjectPickerItems = (projects: Project[]) => {
  const topLevelProjects = projects.filter((project) => !project.parentProjectId);
  const orderedProjects: Project[] = [];

  topLevelProjects.forEach((project) => {
    orderedProjects.push(project);
    orderedProjects.push(
      ...projects.filter((item) => item.parentProjectId === project.id),
    );
  });

  return orderedProjects;
};

export const isSameProjectTodoSource = (
  selectedSource: ProjectTodoSource,
  rowSource: ProjectTodoSource,
) => {
  if (selectedSource.type === "calendar" || rowSource.type === "calendar") {
    return (
      selectedSource.type === "calendar" &&
      rowSource.type === "calendar" &&
      selectedSource.entryId === rowSource.entryId
    );
  }

  return true;
};

export const isSameProjectTodoId = (
  selectedTodoId: string | number | null | undefined,
  rowTodoId: string | number | null | undefined,
) => {
  if (selectedTodoId === null || selectedTodoId === undefined) return false;
  if (rowTodoId === null || rowTodoId === undefined) return false;

  return String(selectedTodoId) === String(rowTodoId);
};

export const getProjectTodoRowKey = (row: ProjectTodoRowLike) => {
  if (row.source.type === "calendar") {
    return `calendar-${row.source.entryId}`;
  }

  return [
    row.source.type,
    String(row.todo.id),
    String(row.todo.projectId ?? "none"),
    row.todo.createdAt ?? "no-created-at",
    String(row.occurrenceIndex ?? 0),
  ].join("-");
};

export const shouldShowCalendarEntryInProject = (
  entry: CalendarEntry,
  projectId: number,
) => {
  if (entry.todo.projectId !== projectId) return false;
  if (entry.isTrackingEntry || entry.timerCompleted || entry.timeSpent) {
    return false;
  }

  return true;
};
