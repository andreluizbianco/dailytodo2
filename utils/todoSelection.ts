export const getNextSelectedTodoAfterRemoval = <T extends { id: number }>(
  todos: T[],
  removedId: number,
): T | null => {
  const removedIndex = todos.findIndex((todo) => todo.id === removedId);
  if (removedIndex === -1) return null;

  const nextTodos = todos.filter((todo) => todo.id !== removedId);
  if (nextTodos.length === 0) return null;

  return nextTodos[Math.min(removedIndex, nextTodos.length - 1)];
};
