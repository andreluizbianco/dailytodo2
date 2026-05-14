import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  View,
  LogBox,
  NativeModules,
  NativeEventEmitter,
  Animated,
  AppState,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TopBar from "./components/TopBar";
import Calendar from "./components/Calendar";
import TodoList from "./components/TodoList";
import TodoNoteColumn from "./components/TodoNoteColumn";
import ProjectList from "./components/ProjectList";
import { Project, Todo, CalendarEntry } from "./types";
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

type ViewType =
  | "notes"
  | "projects"
  | "timer"
  | "settings"
  | "archive"
  | "calendar";
type CalendarViewMode = "day" | "week";
type SelectedTodoSource =
  | { type: "todo" }
  | { type: "archive" }
  | { type: "calendar"; entryId: number };

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
  const [selectedTodoSource, setSelectedTodoSource] =
    useState<SelectedTodoSource>({ type: "todo" });
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
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
    projects,
    trashedTodos,
    trashRetention,
    addTodo,
    addProject,
    updateTodo,
    updateProject,
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
  } = useTodos();

  const todosRef = useRef<Todo[]>([]);
  const activeViewRef = useRef<ViewType>(activeView);
  const previousActiveViewRef = useRef<ViewType>(activeView);
  const appStateRef = useRef(AppState.currentState);
  const didSyncRunningSelectionOnLoadRef = useRef(false);

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

  const handleSelectTodo = useCallback(
    (todo: Todo | null, source: SelectedTodoSource = { type: "todo" }) => {
      setSelectedTodo(todo);
      setSelectedTodoSource(source);
      saveLastSelectedTodoId(
        source.type === "todo" ? (todo?.id ?? null) : null,
      );
    },
    [],
  );

  const handleSelectProject = useCallback((project: Project | null) => {
    setSelectedProject(project);
  }, []);

  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

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

  const syncRunningTodoSelection = useCallback(async () => {
    if (!TimerModule?.getTimerState) return false;
    if (todosRef.current.length === 0) return false;

    try {
      const state = await TimerModule.getTimerState();

      if (!state?.isRunning) return false;

      const runningTodo = todosRef.current.find(
        (todo) => String(todo.id) === String(state.todoId),
      );

      if (runningTodo) {
        handleSelectTodo(runningTodo);
        return true;
      }
    } catch (error) {
      console.warn("Failed to sync running timer selection", error);
    }

    return false;
  }, [handleSelectTodo]);

  useEffect(() => {
    if (!todosLoaded || !didRestoreSelectedTodo) return;
    if (didSyncRunningSelectionOnLoadRef.current) return;

    didSyncRunningSelectionOnLoadRef.current = true;
    syncRunningTodoSelection();
    const retryTimeout = setTimeout(() => {
      syncRunningTodoSelection();
    }, 450);

    return () => clearTimeout(retryTimeout);
  }, [didRestoreSelectedTodo, syncRunningTodoSelection, todosLoaded]);

  useEffect(() => {
    const previousActiveView = previousActiveViewRef.current;
    previousActiveViewRef.current = activeView;

    const shouldSyncRunningSelection =
      (activeView === "notes" || activeView === "timer") &&
      previousActiveView !== activeView;

    if (shouldSyncRunningSelection) {
      syncRunningTodoSelection();
    }
  }, [activeView, syncRunningTodoSelection]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const wasAway = /inactive|background/.test(appStateRef.current);
      appStateRef.current = nextAppState;

      if (
        wasAway &&
        nextAppState === "active" &&
        (activeViewRef.current === "notes" || activeViewRef.current === "timer")
      ) {
        syncRunningTodoSelection();
      }
    });

    return () => subscription.remove();
  }, [syncRunningTodoSelection]);

  const handleAddTodo = async () => {
    if (activeView === "settings") {
      return undefined;
    }

    if (activeView === "projects") {
      if (selectedProject) {
        const newTodo = addTodo({ projectId: selectedProject.id });
        handleSelectTodo(newTodo, { type: "todo" });
        return newTodo;
      }

      const newProject = addProject();
      handleSelectProject(newProject);
      handleSelectTodo(null);
      return newProject;
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
      handleSelectProject(null);
      handleSelectTodo(newTodo, { type: "todo" });
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

  const handleCalendarAddEntry = async () => {
    const entry = await handleAddTodo();
    return entry as Todo | CalendarEntry | undefined;
  };

  const updateCalendarEntryTodo = useCallback(
    async (entryId: number, updates: Partial<Todo>) => {
      const updatedEntries = calendarEntries.map((entry) =>
        entry.id === entryId
          ? { ...entry, todo: { ...entry.todo, ...updates } }
          : entry,
      );

      setCalendarEntries(updatedEntries);
      await AsyncStorage.setItem(
        "calendarEntries",
        JSON.stringify(updatedEntries),
      );
    },
    [calendarEntries],
  );

  const handleRemoveTodo = (id: number): Todo | null => {
    const nextTodo = removeTodo(id);
    handleSelectTodo(nextTodo, { type: "todo" });
    return nextTodo;
  };

  const handleArchiveTodo = (id: number): Todo | null => {
    const nextTodo = archiveTodo(id);
    handleSelectTodo(nextTodo, { type: "todo" });
    return nextTodo;
  };

  const renderMainContent = () => {
    if (activeView === "calendar") {
      return (
        <View style={styles.calendarContainer}>
          <Calendar
            viewMode={calendarViewMode}
            onDateSelect={setSelectedDate}
            onAddEntry={handleCalendarAddEntry}
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
          {activeView === "projects" ? (
            <ProjectList
              projects={projects}
              todos={todos}
              archivedTodos={archivedTodos}
              calendarEntries={calendarEntries}
              selectedProject={currentSelectedProject}
              selectedTodo={currentSelectedTodo}
              selectedTodoSource={selectedTodoSource}
              updateProject={updateProject}
              updateTodo={updateTodo}
              updateArchivedTodo={updateArchivedTodo}
              updateCalendarEntryTodo={updateCalendarEntryTodo}
              setSelectedProject={handleSelectProject}
              setSelectedTodo={handleSelectTodo}
            />
          ) : (
            <TodoList
              todos={todos}
              setTodos={setTodos}
              updateTodo={updateTodo}
              selectedTodo={selectedTodo}
              setSelectedTodo={(todo) => {
                handleSelectProject(null);
                handleSelectTodo(todo, { type: "todo" });
              }}
            />
          )}
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
            selectedTodoSource={selectedTodoSource}
            selectedProject={currentSelectedProject}
            activeView={activeView}
            isNoteFullscreen={isNoteFullscreen}
            updateTodo={updateTodo}
            updateCalendarEntryTodo={updateCalendarEntryTodo}
            updateProject={updateProject}
            removeTodo={handleRemoveTodo} // Use the new handler
            archiveTodo={handleArchiveTodo}
            archivedTodos={archivedTodos}
            setArchivedTodos={setArchivedTodos}
            unarchiveTodo={unarchiveTodo}
            updateArchivedTodo={updateArchivedTodo}
            showSettings={showSettings}
            trashedTodos={trashedTodos}
            trashRetention={trashRetention}
            restoreTrashedTodo={restoreTrashedTodo}
            deleteTrashedTodo={deleteTrashedTodo}
            emptyTrash={emptyTrash}
            setTrashRetention={setTrashRetention}
            printOnCalendar={handlePrintOnCalendar}
            exportData={exportData}
            importData={importData}
            todos={todos}
            setTodos={setTodos}
            projects={projects}
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

  const handleProjectsLongPress = () => {
    setShowSettings(false);
    setIsNoteFullscreen(false);
    setActiveView((prev) => (prev === "projects" ? "notes" : "projects"));
  };

  const handleTopBarViewChange = (view: ViewType) => {
    if (view !== activeView || view !== "notes") {
      setIsNoteFullscreen(false);
    }
    if (view !== "projects") {
      handleSelectProject(null);
    }
    setActiveView(view);
  };

  const currentSelectedTodo = (() => {
    if (!selectedTodo) return null;

    if (selectedTodoSource.type === "archive") {
      return (
        archivedTodos.find((todo) => todo.id === selectedTodo.id) ??
        selectedTodo
      );
    }

    if (selectedTodoSource.type === "calendar") {
      return (
        calendarEntries.find((entry) => entry.id === selectedTodoSource.entryId)
          ?.todo ?? selectedTodo
      );
    }

    return todos.find((todo) => todo.id === selectedTodo.id) ?? selectedTodo;
  })();
  const currentSelectedProject = selectedProject
    ? (projects.find((project) => project.id === selectedProject.id) ?? null)
    : null;

  const handleAddPress = () => {
    if (activeView === "settings") {
      setShowSettings(false);
      setActiveView("notes");
      setIsNoteFullscreen(Boolean(currentSelectedTodo));
      return;
    }

    if (activeView === "archive") {
      setShowSettings(false);
      setIsNoteFullscreen((prev) => !prev);
      return;
    }

    if (activeView === "projects") {
      setShowSettings(false);
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
            onProjectsLongPress={handleProjectsLongPress}
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
