import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_SELECTED_TODO_ID_KEY = "app:lastSelectedTodoId";
const LAST_SIDE_CONTEXT_KEY = "app:lastSideContext";

export type PersistedSideContext = "notes" | "projects";

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

export const loadLastSideContext =
  async (): Promise<PersistedSideContext> => {
    try {
      const storedContext = await AsyncStorage.getItem(LAST_SIDE_CONTEXT_KEY);

      return storedContext === "projects" ? "projects" : "notes";
    } catch (error) {
      console.error("Failed to load last side context:", error);
      return "notes";
    }
  };

export const saveLastSideContext = async (
  sideContext: PersistedSideContext,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(LAST_SIDE_CONTEXT_KEY, sideContext);
  } catch (error) {
    console.error("Failed to save last side context:", error);
  }
};
