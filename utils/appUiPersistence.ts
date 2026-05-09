import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_SELECTED_TODO_ID_KEY = "app:lastSelectedTodoId";

export const loadLastSelectedTodoId = async (): Promise<number | null> => {
  try {
    const storedId = await AsyncStorage.getItem(LAST_SELECTED_TODO_ID_KEY);
    if (!storedId) return null;

    const parsedId = Number(storedId);
    return Number.isFinite(parsedId) ? parsedId : null;
  } catch (error) {
    console.error("Failed to load last selected todo id:", error);
    return null;
  }
};

export const saveLastSelectedTodoId = async (
  todoId: number | null,
): Promise<void> => {
  try {
    if (todoId === null) {
      await AsyncStorage.removeItem(LAST_SELECTED_TODO_ID_KEY);
      return;
    }

    await AsyncStorage.setItem(LAST_SELECTED_TODO_ID_KEY, String(todoId));
  } catch (error) {
    console.error("Failed to save last selected todo id:", error);
  }
};
