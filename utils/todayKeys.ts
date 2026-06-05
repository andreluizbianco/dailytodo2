import { Todo, TodayTodoItem } from "../types";

export const getTodayTodoRenderKey = (
  todo: Todo,
  orderedTodayItems: TodayTodoItem[],
) => {
  const exactItem = orderedTodayItems.find((item) => item.todo === todo);
  if (exactItem) return exactItem.occurrenceKey;

  return (
    orderedTodayItems.find((item) => item.todo.id === todo.id)?.occurrenceKey ??
    String(todo.id)
  );
};
