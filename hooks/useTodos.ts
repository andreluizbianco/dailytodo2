import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { Alert } from "react-native";
import { Todo, CalendarEntry, TrashedTodo, TrashRetention } from "../types";
import { getNextSelectedTodoAfterRemoval } from "../utils/todoSelection";
import {
  createTrashedTodo,
  getRetainedTrashedTodos,
  restoreTodoFromTrash,
} from "../utils/trash";

const CURRENT_VERSION = 1;

interface StoredData {
  version: number;
  todos: Todo[];
  archivedTodos: Todo[];
  calendarEntries?: CalendarEntry[];
  trashedTodos?: TrashedTodo[];
  trashRetention?: TrashRetention;
}

const DEFAULT_TRASH_RETENTION: TrashRetention = "7d";

export const useTodos = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [archivedTodos, setArchivedTodos] = useState<Todo[]>([]);
  const [trashedTodos, setTrashedTodos] = useState<TrashedTodo[]>([]);
  const [trashRetention, setTrashRetentionState] = useState<TrashRetention>(
    DEFAULT_TRASH_RETENTION,
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const saveQueueRef = useRef(Promise.resolve());

  const saveStoredTodos = useCallback(
    (
      nextTodos: Todo[],
      nextArchivedTodos: Todo[],
      nextTrashedTodos: TrashedTodo[],
      nextTrashRetention: TrashRetention,
    ) => {
      const dataToSave: StoredData = {
        version: CURRENT_VERSION,
        todos: nextTodos,
        archivedTodos: nextArchivedTodos,
        trashedTodos: nextTrashedTodos,
        trashRetention: nextTrashRetention,
      };

      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(() =>
          AsyncStorage.setItem("todosData", JSON.stringify(dataToSave)),
        )
        .catch((e) => {
          console.error("Failed to save todos", e);
        });
    },
    [],
  );

  useEffect(() => {
    const loadTodos = async () => {
      try {
        const savedData = await AsyncStorage.getItem("todosData");
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          if (parsedData && parsedData.version === CURRENT_VERSION) {
            const parsedRetention =
              parsedData.trashRetention ?? DEFAULT_TRASH_RETENTION;
            const retainedTrashedTodos = getRetainedTrashedTodos(
              parsedData.trashedTodos ?? [],
              parsedRetention,
              new Date().toISOString(),
            );

            setTodos(parsedData.todos);
            setArchivedTodos(parsedData.archivedTodos);
            setTrashedTodos(retainedTrashedTodos);
            setTrashRetentionState(parsedRetention);
          } else if (Array.isArray(parsedData)) {
            setTodos(parsedData);
            setArchivedTodos([]);
            setTrashedTodos([]);
          }
        }
      } catch (e) {
        console.error("Failed to load todos", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadTodos();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    saveStoredTodos(todos, archivedTodos, trashedTodos, trashRetention);
  }, [
    todos,
    archivedTodos,
    trashedTodos,
    trashRetention,
    isLoaded,
    saveStoredTodos,
  ]);

  const addTodo = (): Todo => {
    const newTodo: Todo = {
      id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
      text: "",
      note: "",
      color: "blue",
      isEditing: true,
      noteType: "text",
      createdAt: new Date().toISOString(),
      timerMode: "pomodoro",
      timer: {
        hours: "00",
        minutes: "25",
        isActive: false,
      },
    };
    setTodos((prevTodos) => [...prevTodos, newTodo]);
    return newTodo;
  };

  const updateTodo = async (
    id: number,
    updates: Partial<Todo>,
  ): Promise<void> => {
    setTodos((prevTodos) => {
      const nextTodos = prevTodos.map((todo) =>
        todo.id === id ? { ...todo, ...updates } : todo,
      );

      saveStoredTodos(nextTodos, archivedTodos, trashedTodos, trashRetention);

      return nextTodos;
    });
  };

  const updateArchivedTodo = (id: number, updates: Partial<Todo>): void => {
    setArchivedTodos((prevTodos) =>
      prevTodos.map((todo) =>
        todo.id === id ? { ...todo, ...updates } : todo,
      ),
    );
  };

  const removeTodo = (id: number): Todo | null => {
    const todoToTrash = todos.find((todo) => todo.id === id);
    const nextSelectedTodo = getNextSelectedTodoAfterRemoval(todos, id);

    if (todoToTrash) {
      setTrashedTodos((prevTodos) =>
        getRetainedTrashedTodos(
          [
            ...prevTodos,
            createTrashedTodo(todoToTrash, new Date().toISOString()),
          ],
          trashRetention,
          new Date().toISOString(),
        ),
      );
    }

    setTodos((prevTodos) => {
      return prevTodos.filter((todo) => todo.id !== id);
    });

    return nextSelectedTodo;
  };

  const archiveTodo = (id: number): Todo | null => {
    const todoToArchive = todos.find((todo) => todo.id === id);
    const nextSelectedTodo = getNextSelectedTodoAfterRemoval(todos, id);

    if (todoToArchive) {
      setArchivedTodos((prevArchivedTodos) => [
        ...prevArchivedTodos,
        { ...todoToArchive, isEditing: false },
      ]);
      setTodos((prevTodos) => prevTodos.filter((todo) => todo.id !== id));
    }

    return nextSelectedTodo;
  };

  const unarchiveTodo = (id: number): void => {
    const todoToUnarchive = archivedTodos.find((todo) => todo.id === id);
    if (todoToUnarchive) {
      setTodos((prevTodos) => [
        ...prevTodos,
        { ...todoToUnarchive, isEditing: false },
      ]);
      setArchivedTodos((prevArchivedTodos) =>
        prevArchivedTodos.filter((todo) => todo.id !== id),
      );
    }
  };

  const restoreTrashedTodo = (id: number): void => {
    const todoToRestore = trashedTodos.find((todo) => todo.id === id);
    if (!todoToRestore) return;

    setTodos((prevTodos) => [...prevTodos, restoreTodoFromTrash(todoToRestore)]);
    setTrashedTodos((prevTodos) => prevTodos.filter((todo) => todo.id !== id));
  };

  const deleteTrashedTodo = (id: number): void => {
    setTrashedTodos((prevTodos) => prevTodos.filter((todo) => todo.id !== id));
  };

  const emptyTrash = (): void => {
    setTrashedTodos([]);
  };

  const setTrashRetention = (retention: TrashRetention): void => {
    setTrashRetentionState(retention);
    setTrashedTodos((prevTodos) =>
      getRetainedTrashedTodos(prevTodos, retention, new Date().toISOString()),
    );
  };

  const exportData = async () => {
    try {
      const calendarEntriesStr = await AsyncStorage.getItem("calendarEntries");
      const calendarEntries = calendarEntriesStr
        ? JSON.parse(calendarEntriesStr)
        : [];

      const dataToExport: StoredData = {
        version: CURRENT_VERSION,
        todos,
        archivedTodos,
        calendarEntries,
        trashedTodos,
        trashRetention,
      };

      const jsonString = JSON.stringify(dataToExport, null, 2);
      const fileUri = `${FileSystem.documentDirectory}todos_backup.json`;

      await FileSystem.writeAsStringAsync(fileUri, jsonString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        try {
          await Sharing.shareAsync(fileUri, {
            mimeType: "application/json",
            dialogTitle: "Export Todos Data",
            UTI: "public.json", // for iOS
          }).then(() => {
            // Show success message after the share sheet is dismissed and the share was completed
            setTimeout(() => {
              Alert.alert("Success", "Data exported successfully!");
            }, 500);
          });
        } catch (error) {
          if (error instanceof Error) {
            console.error("Share error:", error.message);
            Alert.alert("Error", "Failed to share data. Please try again.");
          }
        }
      } else {
        Alert.alert("Error", "Sharing is not available on this device");
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      Alert.alert("Error", "Failed to export data. Please try again.");
    }
  };

  const importData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const fileContents = await FileSystem.readAsStringAsync(
          result.assets[0].uri,
        );
        const importedData = JSON.parse(fileContents);

        if (importedData.version === CURRENT_VERSION) {
          setTodos(importedData.todos);
          setArchivedTodos(importedData.archivedTodos);
          setTrashedTodos(
            getRetainedTrashedTodos(
              importedData.trashedTodos ?? [],
              importedData.trashRetention ?? DEFAULT_TRASH_RETENTION,
              new Date().toISOString(),
            ),
          );
          setTrashRetentionState(
            importedData.trashRetention ?? DEFAULT_TRASH_RETENTION,
          );

          if (importedData.calendarEntries) {
            await AsyncStorage.setItem(
              "calendarEntries",
              JSON.stringify(importedData.calendarEntries),
            );
          }

          Alert.alert("Success", "Data imported successfully!");
        } else {
          Alert.alert("Error", "Incompatible data format");
        }
      }
    } catch (error) {
      console.error("Error importing data:", error);
      Alert.alert("Error", "Failed to import data. Please try again.");
    }
  };

  return {
    isLoaded,
    todos,
    setTodos,
    archivedTodos,
    setArchivedTodos,
    trashedTodos,
    trashRetention,
    addTodo,
    updateTodo,
    updateArchivedTodo,
    removeTodo,
    archiveTodo,
    unarchiveTodo,
    restoreTrashedTodo,
    deleteTrashedTodo,
    emptyTrash,
    setTrashRetention,
    exportData,
    importData,
  };
};
