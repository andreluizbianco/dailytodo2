import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  View,
  LogBox,
  NativeModules,
  NativeEventEmitter,
  Animated,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TopBar from "./components/TopBar";
import Calendar from "./components/Calendar";
import TodoList from "./components/TodoList";
import TodoNoteColumn from "./components/TodoNoteColumn";
import { Todo, CalendarEntry } from "./types";
import { useTodos } from "./hooks/useTodos";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider, useTheme } from "./utils/theme";
import { addTimerEntryToCalendar } from "./utils/calendarStorage";
import {
  applyTimerAlertPreferences,
  loadTimerAlertPreferences,
} from "./utils/timerAlertPreferences";
import {
  loadLastSelectedTodoId,
  saveLastSelectedTodoId,
} from "./utils/appUiPersistence";
import {
  createCalendarReminderTodo,
  reconcileTodoReminders,
} from "./utils/reminders";

const { TimerModule } = NativeModules;

// Ignore the specific warning about defaultProps
LogBox.ignoreLogs(["Warning: ExpandableCalendar: Support for defaultProps"]);

type ViewType = "notes" | "timer" | "settings" | "archive" | "calendar";
type CalendarViewMode = "day" | "week";

const AppContent = () => {
  const { isDarkMode, theme } = useTheme();
  const themeAnimation = useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;
  const [activeView, setActiveView] = useState<ViewType>("notes");
  const settingsLayoutAnimation = useRef(
    new Animated.Value(activeView === "settings" ? 1 : 0),
  ).current;
  const [showSettings, setShowSettings] = useState(false);
  const [isNoteFullscreen, setIsNoteFullscreen] = useState(false);
  const [calendarViewMode, setCalendarViewMode] =
    useState<CalendarViewMode>("day");
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [didRestoreSelectedTodo, setDidRestoreSelectedTodo] = useState(false);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const {
    todos,
    isLoaded: todosLoaded,
    setTodos,
    archivedTodos,
    setArchivedTodos,
    addTodo,
    updateTodo,
    updateArchivedTodo,
    removeTodo,
    archiveTodo,
    unarchiveTodo,
    exportData,
    importData,
  } = useTodos();

  const todosRef = useRef<Todo[]>([]);

  useEffect(() => {
    Animated.timing(themeAnimation, {
      toValue: isDarkMode ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isDarkMode, themeAnimation]);

  useEffect(() => {
    Animated.timing(settingsLayoutAnimation, {
      toValue: activeView === "settings" || isNoteFullscreen ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [activeView, isNoteFullscreen, settingsLayoutAnimation]);

  const handleSelectTodo = useCallback((todo: Todo | null) => {
    setSelectedTodo(todo);
    saveLastSelectedTodoId(todo?.id ?? null);
  }, []);

  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  useEffect(() => {
    if (!todosLoaded) return;

    const calendarReminderTodos = calendarEntries.map(
      createCalendarReminderTodo,
    );

    reconcileTodoReminders([
      ...todos,
      ...archivedTodos,
      ...calendarReminderTodos,
    ]).catch((error) => {
      console.error("Failed to reconcile reminders", error);
    });
  }, [archivedTodos, calendarEntries, todos, todosLoaded]);

  useEffect(() => {
    if (!todosLoaded || didRestoreSelectedTodo) return;

    const restoreSelectedTodo = async () => {
      const savedTodoId = await loadLastSelectedTodoId();
      const restoredTodo = savedTodoId
        ? todos.find((todo) => Number(todo.id) === Number(savedTodoId))
        : null;

      if (restoredTodo) {
        handleSelectTodo(restoredTodo);
      } else {
        handleSelectTodo(todos[0] ?? null);
      }

      setDidRestoreSelectedTodo(true);
    };

    restoreSelectedTodo();
  }, [didRestoreSelectedTodo, handleSelectTodo, todos, todosLoaded]);

  useEffect(() => {
    const syncTimerAlertPreferences = async () => {
      const preferences = await loadTimerAlertPreferences();
      applyTimerAlertPreferences(preferences);
    };

    syncTimerAlertPreferences();
  }, []);

  useEffect(() => {
    if (!TimerModule) return;

    const emitter = new NativeEventEmitter(TimerModule);

    const subscription = emitter.addListener(
      "TIMER_FINISHED",
      async (event) => {
        TimerModule.clearPendingCompletion?.();

        const todoId = Number(event.todoId);
        const todo = todosRef.current.find((t) => Number(t.id) === todoId);

        if (!todo) {
          console.log(
            "TIMER_FINISHED received, but todo was not found:",
            event,
          );
          return;
        }

        updateTodo(todo.id, {
          timer: {
            hours: todo.timer?.hours ?? "00",
            minutes: todo.timer?.minutes ?? "25",
            isActive: false,
          },
        });

        const entry = await addTimerEntryToCalendar({
          todo,
          completed: event.completed,
          startedAt: event.startedAt,
          elapsedSeconds: event.activeElapsedSeconds,
        });

        if (entry) {
          setCalendarEntries((prev) => {
            const alreadyExists = prev.some(
              (existing) => existing.id === entry.id,
            );
            if (alreadyExists) return prev;
            return [...prev, entry];
          });
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [updateTodo]);

  useEffect(() => {
    const syncPendingTimerCompletion = async () => {
      if (todos.length === 0) return;
      if (!TimerModule?.getPendingCompletion) return;

      try {
        const event = await TimerModule.getPendingCompletion();

        if (!event) return;

        const todoId = String(event.todoId);
        const todo = todosRef.current.find((t) => String(t.id) === todoId);

        if (!todo) {
          console.log(
            "Pending timer completion found, but todo was not found:",
            event,
          );
          return;
        }

        const entry = await addTimerEntryToCalendar({
          todo,
          completed: event.completed,
          startedAt: event.startedAt,
          elapsedSeconds: event.activeElapsedSeconds,
        });

        if (entry) {
          setCalendarEntries((prev) => {
            const alreadyExists = prev.some(
              (existing) => existing.id === entry.id,
            );

            if (alreadyExists) return prev;

            return [...prev, entry];
          });
        }

        TimerModule.clearPendingCompletion();
      } catch (error) {
        console.log("Error syncing pending timer completion:", error);
      }
    };

    syncPendingTimerCompletion();
  }, [todos]);

  useEffect(() => {
    const syncRunningTodoSelection = async () => {
      if (activeView !== "notes") return;
      if (!TimerModule?.getTimerState) return;
      if (todos.length === 0) return;

      const state = await TimerModule.getTimerState();

      if (!state?.isRunning) return;

      const runningTodo = todos.find(
        (todo) => String(todo.id) === String(state.todoId),
      );

      if (runningTodo) {
        handleSelectTodo(runningTodo);
      }
    };

    syncRunningTodoSelection();
  }, [activeView, handleSelectTodo, todos]);

  const handleAddTodo = async () => {
    if (activeView === "settings") {
      return undefined;
    }

    if (activeView === "calendar") {
      const newTodo: Todo = {
        id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
        text: "",
        note: "",
        color: "blue",
        isEditing: true,
        noteType: "text",
        createdAt: new Date().toISOString(),
      };

      const calendarEntry: CalendarEntry = {
        id: Date.now(),
        todo: newTodo,
        printedAt: `${selectedDate}T${new Date().toTimeString().split(" ")[0]}`,
      };

      // Update state immediately
      setCalendarEntries((prev) => [...prev, calendarEntry]);

      // Save to storage in background
      try {
        const savedEntries = await AsyncStorage.getItem("calendarEntries");
        const currentEntries = savedEntries ? JSON.parse(savedEntries) : [];
        const updatedEntries = [...currentEntries, calendarEntry];
        await AsyncStorage.setItem(
          "calendarEntries",
          JSON.stringify(updatedEntries),
        );
      } catch (error) {
        console.error("Error saving calendar entry:", error);
      }

      return calendarEntry;
    } else {
      const newTodo = addTodo();
      handleSelectTodo(newTodo);
      return newTodo;
    }
  };

  const handlePrintOnCalendar = async (todo: Todo) => {
    const calendarEntry: CalendarEntry = {
      id: Date.now(),
      todo: { ...todo },
      printedAt: new Date().toISOString(),
    };

    try {
      const savedEntries = await AsyncStorage.getItem("calendarEntries");
      const currentEntries = savedEntries ? JSON.parse(savedEntries) : [];
      const updatedEntries = [...currentEntries, calendarEntry];
      await AsyncStorage.setItem(
        "calendarEntries",
        JSON.stringify(updatedEntries),
      );
    } catch (error) {
      console.error("Error saving calendar entry:", error);
    }
  };

  const handleRemoveTodo = (id: number): Todo | null => {
    const nextTodo = removeTodo(id);
    handleSelectTodo(nextTodo);
    return nextTodo;
  };

  const renderMainContent = () => {
    if (activeView === "calendar") {
      return (
        <View style={styles.calendarContainer}>
          <Calendar
            viewMode={calendarViewMode}
            onDateSelect={setSelectedDate}
            onAddEntry={handleAddTodo}
            entries={calendarEntries}
            setEntries={setCalendarEntries}
            todos={todos}
            setTodos={setTodos}
            updateTodo={updateTodo}
          />
        </View>
      );
    }

    return (
      <View style={styles.content}>
        <Animated.View
          pointerEvents={activeView === "settings" ? "none" : "auto"}
          style={[
            styles.todoListContainer,
            {
              opacity: settingsLayoutAnimation.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [1, 0.2, 0],
              }),
              transform: [
                {
                  translateX: settingsLayoutAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -80],
                  }),
                },
              ],
              width: settingsLayoutAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: ["40%", "0%"],
              }),
            },
          ]}
        >
          <TodoList
            todos={todos}
            setTodos={setTodos}
            updateTodo={updateTodo}
            selectedTodo={selectedTodo}
            setSelectedTodo={handleSelectTodo}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.todoNoteColumnContainer,
            {
              width: settingsLayoutAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: ["60%", "100%"],
              }),
            },
          ]}
        >
          <TodoNoteColumn
            selectedTodo={currentSelectedTodo}
            activeView={activeView}
            isNoteFullscreen={isNoteFullscreen}
            updateTodo={updateTodo}
            removeTodo={handleRemoveTodo} // Use the new handler
            archiveTodo={archiveTodo}
            archivedTodos={archivedTodos}
            setArchivedTodos={setArchivedTodos}
            unarchiveTodo={unarchiveTodo}
            updateArchivedTodo={updateArchivedTodo}
            showSettings={showSettings}
            printOnCalendar={handlePrintOnCalendar}
            exportData={exportData}
            importData={importData}
            todos={todos}
            setTodos={setTodos}
            setShowSettings={setShowSettings}
          />
        </Animated.View>
      </View>
    );
  };

  const handleCalendarPress = () => {
    if (activeView !== "calendar") {
      setIsNoteFullscreen(false);
      setActiveView("calendar");
    } else {
      setCalendarViewMode((prev) => (prev === "day" ? "week" : "day"));
    }
  };

  const handleSettingsLongPress = () => {
    setShowSettings(false);
    setIsNoteFullscreen(false);
    setActiveView((prev) => (prev === "settings" ? "notes" : "settings"));
  };

  const handleTopBarViewChange = (view: ViewType) => {
    if (view !== "notes") {
      setIsNoteFullscreen(false);
    }
    setActiveView(view);
  };

  const currentSelectedTodo = selectedTodo
    ? (todos.find((todo) => todo.id === selectedTodo.id) ?? selectedTodo)
    : null;

  const handleAddPress = () => {
    if (activeView === "settings") {
      setShowSettings(false);
      setActiveView("notes");
      setIsNoteFullscreen(Boolean(currentSelectedTodo));
      return;
    }

    setShowSettings(false);
    setActiveView("notes");

    if (!currentSelectedTodo) {
      setIsNoteFullscreen(false);
      return;
    }

    setIsNoteFullscreen((prev) => (activeView === "notes" ? !prev : true));
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: themeAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: ["#FFFFFF", theme.background],
            }),
          },
        ]}
      >
        <SafeAreaView
          style={[styles.container, { backgroundColor: "transparent" }]}
        >
          <StatusBar style={isDarkMode ? "light" : "dark"} />
          <TopBar
            onAddTodo={handleAddTodo}
            onAddPress={handleAddPress}
            onSettingsLongPress={handleSettingsLongPress}
            activeView={activeView}
            setActiveView={handleTopBarViewChange}
            showSettings={showSettings}
            setShowSettings={setShowSettings}
            onCalendarPress={handleCalendarPress}
          />
          {renderMainContent()}
        </SafeAreaView>
      </Animated.View>
    </GestureHandlerRootView>
  );
};

const App = () => (
  <ThemeProvider>
    <AppContent />
  </ThemeProvider>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  content: {
    flex: 1,
    flexDirection: "row",
    paddingLeft: 0,
    paddingRight: 4,
    paddingBottom: 20,
  },
  todoListContainer: {
    width: "40%",
    overflow: "hidden",
  },
  todoNoteColumnContainer: {
    width: "60%",
  },
  calendarContainer: {
    flex: 1,
    width: "100%",
  },
});

export default App;
