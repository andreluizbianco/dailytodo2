import { TodayTodoSource, Todo } from "../types";
import { shouldArchiveCompletedActiveTodo } from "./todayCompletion";

export const getCompletionDismissalSources = (
  todo: Todo,
  source: TodayTodoSource | null,
): TodayTodoSource[] => {
  if (!source) return [];

  if (source.type !== "active") return [source];

  if (!todo.projectId && !shouldArchiveCompletedActiveTodo(todo)) {
    return [source];
  }

  return [
    source,
    {
      type: "archived-repeat",
      todoId: source.todoId,
    },
  ];
};
