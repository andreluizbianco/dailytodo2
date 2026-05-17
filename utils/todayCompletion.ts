import { Todo } from "../types";

export const shouldArchiveCompletedActiveTodo = (todo: Todo) => {
  return Boolean(todo.schedule);
};
