import { Todo, TrashedTodo, TrashRetention } from "../types";

const retentionDaysByValue: Record<Exclude<TrashRetention, "never">, number> = {
  "3d": 3,
  "7d": 7,
  "30d": 30,
};

export const createTrashedTodo = (
  todo: Todo,
  deletedAt: string,
): TrashedTodo => ({
  ...todo,
  isEditing: false,
  deletedAt,
});

export const restoreTodoFromTrash = (todo: TrashedTodo): Todo => {
  const { deletedAt: _deletedAt, ...restoredTodo } = todo;
  return {
    ...restoredTodo,
    isEditing: false,
  };
};

export const getRetainedTrashedTodos = (
  trashedTodos: TrashedTodo[],
  retention: TrashRetention,
  nowIso: string,
): TrashedTodo[] => {
  if (retention === "never") return trashedTodos;

  const retentionMs = retentionDaysByValue[retention] * 24 * 60 * 60 * 1000;
  const nowMs = new Date(nowIso).getTime();

  return trashedTodos.filter((todo) => {
    const deletedAtMs = new Date(todo.deletedAt).getTime();
    if (Number.isNaN(deletedAtMs)) return true;
    return nowMs - deletedAtMs <= retentionMs;
  });
};
