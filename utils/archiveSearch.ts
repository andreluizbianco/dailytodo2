import { Todo } from "../types";
import { getArchivePreviewText } from "./archivePreview";

interface ArchiveSearchFilters {
  titleQuery: string;
  bodyQuery: string;
}

const includesQuery = (value: string, query: string): boolean =>
  value.toLowerCase().includes(query.trim().toLowerCase());

export const filterArchivedTodos = <T extends Pick<Todo, "text" | "note">>(
  archivedTodos: T[],
  { titleQuery, bodyQuery }: ArchiveSearchFilters,
): T[] => {
  const trimmedTitleQuery = titleQuery.trim();
  const trimmedBodyQuery = bodyQuery.trim();

  if (!trimmedTitleQuery && !trimmedBodyQuery) return archivedTodos;

  return archivedTodos.filter((todo) => {
    const matchesTitle =
      !trimmedTitleQuery || includesQuery(todo.text, trimmedTitleQuery);
    const matchesBody =
      !trimmedBodyQuery ||
      includesQuery(getArchivePreviewText(todo.note), trimmedBodyQuery);

    return matchesTitle && matchesBody;
  });
};
