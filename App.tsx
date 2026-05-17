import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import {
  Project,
  Todo,
  CalendarEntry,
  TodayTodoItem,
  TodayTodoSource,
} from "./types";
import { useTodos } from "./hooks/useTodos";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider, useTheme } from "./utils/theme";
import {
  addTimerEntryToCalendar,
  replaceCalendarEntry,
} from "./utils/calendarStorage";
import {
  applyTimerAlertPreferences,
  loadTimerAlertPreferences,
} from "./utils/timerAlertPreferences";
import {
  loadLastSideContext,
  loadLastSelectedTodoId,
  saveLastSideContext,
  saveLastSelectedTodoId,
} from "./utils/appUiPersistence";
import {
  createCalendarReminderTodo,
  reconcileTodoReminders,
} from "./utils/reminders";
import {
  buildTodayItems,
  getDayKey,
  getTodayOccurrenceKey,
  isScheduleDueOnDay,
} from "./utils/todayView";
import {
  applyTodayDisplayOrder,
  createTodayDisplayOrder,
} from "./utils/todayOrder";
import {
  dismissTodayOccurrence,
  loadDismissedTodayOccurrences,
} from "./utils/todayDismissals";
import { shouldArchiveCompletedActiveTodo } from "./utils/todayCompletion";

const { TimerModule } = NativeModules;
const DAILY_ORDER_KEY_PREFIX = "dailyOrder:";

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
type SideContext = "notes" | "projects";
type SelectedTodoSource =
  | { type: "todo" }
  | { type: "archive" }
  | { type: "calendar"; entryId: number };
type NotificationTarget = {
  todoId?: string;
  targetType?: string;
  reminderId?: string;
};

const AppContent = () => {
  const { isDarkMode, theme } = useTheme();
  const themeAnimation = useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;
  const [activeView, setActiveView] = useState<ViewType>("notes");
  const [sideContext, setSideContext] = useState<SideContext>("notes");
  const [didRestoreSideContext, setDidRestoreSideContext] = useState(false);
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
  const [todayDate, setTodayDate] = useState(() => new Date());
  const [dismissedTodayKeys, setDismissedTodayKeys] = useState<string[]>([]);
  const [dailyOrderKeys, setDailyOrderKeys] = useState<string[] | null>(null);
  const [selectedTodaySource, setSelectedTodaySource] =
    useState<TodayTodoSource | null>(null);
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
    removeProject,
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
  const archivedTodosRef = useRef<Todo[]>([]);
  const calendarEntriesRef = useRef<CalendarEntry[]>([]);
  const projectsRef = useRef<Project[]>([]);
  const activeViewRef = useRef<ViewType>(activeView);
  const previousActiveViewRef = useRef<ViewType>(activeView);
  const appStateRef = useRef(AppState.currentState);
  const didSyncRunningSelectionOnLoadRef = useRef(false);
  const processedTimerCompletionKeysRef = useRef<Set<string>>(new Set());

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
      setSelectedTodaySource(null);
      saveLastSelectedTodoId(
        source.type === "todo" ? (todo?.id ?? null) : null,
      );
    },
    [],
  );

  const handleSelectTodayItem = useCallback((item: TodayTodoItem | null) => {
    if (!item) {
      setSelectedTodo(null);
      setSelectedTodoSource({ type: "todo" });
      setSelectedTodaySource(null);
      saveLastSelectedTodoId(null);
      return;
    }

    setSelectedTodo(item.todo);
    setSelectedTodaySource(item.source);

    if (item.source.type === "calendar-instance") {
      setSelectedTodoSource({
        type: "calendar",
        entryId: item.source.entryId,
      });
      saveLastSelectedTodoId(null);
      return;
    }

    if (item.source.type === "archived-repeat") {
      setSelectedTodoSource({ type: "archive" });
      saveLastSelectedTodoId(null);
      return;
    }

    setSelectedTodoSource({ type: "todo" });
    saveLastSelectedTodoId(item.todo.id);
  }, []);

  const handleSelectProject = useCallback((project: Project | null) => {
    setSelectedProject(project);
    if (project) {
      setSelectedTodaySource(null);
    }
  }, []);

  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  useEffect(() => {
    archivedTodosRef.current = archivedTodos;
  }, [archivedTodos]);

  useEffect(() => {
    calendarEntriesRef.current = calendarEntries;
  }, [calendarEntries]);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const updateCalendarEntryTodo = useCallback(
    async (entryId: number, updates: Partial<Todo>) => {
      const updatedEntries = calendarEntriesRef.current.map((entry) =>
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
    [],
  );

  const clearCalendarProject = useCallback(async (projectId: number) => {
    const updatedEntries = calendarEntriesRef.current.map((entry) =>
      entry.todo.projectId === projectId
        ? { ...entry, todo: { ...entry.todo, projectId: undefined } }
        : entry,
    );

    setCalendarEntries(updatedEntries);
    await AsyncStorage.setItem(
      "calendarEntries",
      JSON.stringify(updatedEntries),
    );
  }, []);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    const restoreSideContext = async () => {
      const restoredContext = await loadLastSideContext();
      setSideContext(restoredContext);
      setDidRestoreSideContext(true);

      if (restoredContext !== "projects") return;

      try {
        const timerState = await TimerModule?.getTimerState?.();

        if (timerState?.isRunning) {
          setActiveView("timer");
          return;
        }
      } catch (error) {
        console.warn("Failed to check timer before restoring projects", error);
      }

      setActiveView("projects");
    };

    restoreSideContext();
  }, []);

  useEffect(() => {
    if (!didRestoreSideContext) return;

    saveLastSideContext(sideContext);
  }, [didRestoreSideContext, sideContext]);

  useEffect(() => {
    const loadDismissals = async () => {
      setDismissedTodayKeys(
        await loadDismissedTodayOccurrences(getDayKey(todayDate)),
      );
    };

    loadDismissals();
  }, [todayDate]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTodayDate((currentDate) => {
        const now = new Date();
        return getDayKey(now) === getDayKey(currentDate) ? currentDate : now;
      });
    }, 60_000);

    return () => clearInterval(timer);
  }, []);

  const todayItems = useMemo(
    () =>
      buildTodayItems({
        activeTodos: todos,
        archivedTodos,
        calendarEntries,
        date: todayDate,
        dismissedOccurrenceKeys: dismissedTodayKeys,
      }),
    [archivedTodos, calendarEntries, dismissedTodayKeys, todayDate, todos],
  );
  const orderedTodayItems = useMemo(
    () => applyTodayDisplayOrder(todayItems, dailyOrderKeys),
    [dailyOrderKeys, todayItems],
  );
  useEffect(() => {
    const loadDailyOrder = async () => {
      try {
        const savedOrder = await AsyncStorage.getItem(
          `${DAILY_ORDER_KEY_PREFIX}${getDayKey(todayDate)}`,
        );
        const parsedOrder = savedOrder ? JSON.parse(savedOrder) : null;

        setDailyOrderKeys(
          Array.isArray(parsedOrder)
            ? parsedOrder.filter((key): key is string => typeof key === "string")
            : null,
        );
      } catch (error) {
        console.error("Failed to load daily order:", error);
        setDailyOrderKeys(null);
      }
    };

    loadDailyOrder();
  }, [todayDate]);

  const handleTodayReorder = useCallback(
    (nextTodos: Todo[]) => {
      const usedKeys = new Set<string>();
      const nextItems = nextTodos
        .map((todo) => {
          const item = orderedTodayItems.find((candidate) => {
            return (
              !usedKeys.has(candidate.occurrenceKey) &&
              candidate.todo === todo
            );
          });

          if (item) {
            usedKeys.add(item.occurrenceKey);
            return item;
          }

          const fallbackItem = orderedTodayItems.find((candidate) => {
            return (
              !usedKeys.has(candidate.occurrenceKey) &&
              candidate.todo.id === todo.id
            );
          });

          if (fallbackItem) {
            usedKeys.add(fallbackItem.occurrenceKey);
          }

          return fallbackItem;
        })
        .filter((item): item is TodayTodoItem => Boolean(item));
      const nextOrderKeys = createTodayDisplayOrder(nextItems);

      setDailyOrderKeys(nextOrderKeys);
      AsyncStorage.setItem(
        `${DAILY_ORDER_KEY_PREFIX}${getDayKey(todayDate)}`,
        JSON.stringify(nextOrderKeys),
      ).catch((error) => {
        console.error("Failed to save daily order:", error);
      });
    },
    [orderedTodayItems, todayDate],
  );

  const updateTodayTodo = useCallback(
    (id: number, updates: Partial<Todo>) => {
      const item = todayItems.find((todayItem) => todayItem.todo.id === id);

      if (!item || item.source.type === "active") {
        updateTodo(id, updates);
        return;
      }

      if (item.source.type === "archived-repeat") {
        updateArchivedTodo(item.source.todoId, updates);
        return;
      }

      updateCalendarEntryTodo(item.source.entryId, updates);
    },
    [todayItems, updateArchivedTodo, updateCalendarEntryTodo, updateTodo],
  );

  const dismissSelectedTodayOccurrence = useCallback(async () => {
    if (!selectedTodaySource) return false;

    const occurrenceKey = getTodayOccurrenceKey({
      source: selectedTodaySource,
      date: todayDate,
    });
    const nextKeys = await dismissTodayOccurrence(occurrenceKey);

    setDismissedTodayKeys(nextKeys);
    setSelectedTodo(null);
    setSelectedTodoSource({ type: "todo" });
    setSelectedTodaySource(null);
    return true;
  }, [selectedTodaySource, todayDate]);

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
    const loadCalendarEntries = async () => {
      try {
        const savedEntries = await AsyncStorage.getItem("calendarEntries");
        if (!savedEntries) return;

        const parsedEntries = JSON.parse(savedEntries);
        if (Array.isArray(parsedEntries)) {
          setCalendarEntries(parsedEntries);
        }
      } catch (error) {
        console.error("Error loading calendar entries:", error);
      }
    };

    loadCalendarEntries();
  }, []);

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
        const todo = findTimerSubject(todoId);

        if (!todo) {
          console.log(
            "TIMER_FINISHED received, but todo was not found:",
            event,
          );
          return;
        }

        updateTimerSubject(todo.id, {
          timer: {
            hours: todo.timer?.hours ?? "00",
            minutes: todo.timer?.minutes ?? "25",
            isActive: false,
          },
        });

        await recordTimerCompletion(todo, event);
      },
    );

    return () => {
      subscription.remove();
    };
  }, [findTimerSubject, updateTimerSubject]);

  useEffect(() => {
    const syncPendingTimerCompletion = async () => {
      if (!TimerModule?.getPendingCompletion) return;

      try {
        const event = await TimerModule.getPendingCompletion();

        if (!event) return;

        const todoId = String(event.todoId);
        const todo = findTimerSubject(todoId);

        if (!todo) {
          console.log(
            "Pending timer completion found, but todo was not found:",
            event,
          );
          return;
        }

        await recordTimerCompletion(todo, event);

        TimerModule.clearPendingCompletion();
      } catch (error) {
        console.log("Error syncing pending timer completion:", error);
      }
    };

    syncPendingTimerCompletion();
  }, [findTimerSubject]);

  function getProjectAsTimerTodo(project: Project): Todo {
    return {
      id: project.id,
      text: project.title,
      note: project.note,
      color: project.color,
      isEditing: project.isEditing,
      noteType: "text",
      createdAt: project.createdAt,
      timerMode: project.timerMode,
      timer: project.timer,
    };
  }

  function findTimerSubject(rawId: number | string): Todo | null {
    const id = String(rawId);
    const currentTodo = todosRef.current.find((todo) => String(todo.id) === id);
    if (currentTodo) return currentTodo;

    const archivedTodo = archivedTodosRef.current.find(
      (todo) => String(todo.id) === id,
    );
    if (archivedTodo) return archivedTodo;

    const calendarTodo = calendarEntriesRef.current.find(
      (entry) => String(entry.todo.id) === id,
    )?.todo;
    if (calendarTodo) return calendarTodo;

    const project = projectsRef.current.find(
      (projectItem) => String(projectItem.id) === id,
    );
    if (project) return getProjectAsTimerTodo(project);

    return null;
  }

  function findTodaySourceForTimerSubject(
    rawId: number | string,
  ): TodayTodoSource | null {
    const id = String(rawId);
    const currentTodo = todosRef.current.find((todo) => String(todo.id) === id);
    if (currentTodo) {
      return { type: "active", todoId: currentTodo.id };
    }

    const now = new Date();
    const archivedTodo = archivedTodosRef.current.find(
      (todo) =>
        String(todo.id) === id &&
        Boolean(todo.schedule) &&
        isScheduleDueOnDay(todo.schedule!, now),
    );
    if (archivedTodo) {
      return { type: "archived-repeat", todoId: archivedTodo.id };
    }

    const calendarEntry = calendarEntriesRef.current.find(
      (entry) =>
        String(entry.todo.id) === id &&
        getDayKey(new Date(entry.printedAt)) === getDayKey(now),
    );
    if (calendarEntry) {
      return {
        type: "calendar-instance",
        entryId: calendarEntry.id,
        todoId: calendarEntry.todo.id,
      };
    }

    return null;
  }

  async function replaceCalendarEntryInStorage(
    entryId: number,
    replacement: CalendarEntry,
  ) {
    const updatedEntries = replaceCalendarEntry(
      calendarEntriesRef.current,
      entryId,
      replacement,
    );

    setCalendarEntries(updatedEntries);
    await AsyncStorage.setItem(
      "calendarEntries",
      JSON.stringify(updatedEntries),
    );
  }

  async function dismissTodaySource(source: TodayTodoSource, date = new Date()) {
    const nextKeys = await dismissTodayOccurrence(
      getTodayOccurrenceKey({ source, date }),
    );

    if (getDayKey(date) === getDayKey(todayDate)) {
      setDismissedTodayKeys(nextKeys);
    }
  }

  async function recordTimerCompletion(
    todo: Todo,
    event: {
      completed: boolean;
      startedAt: number;
      finishedAt?: number;
      activeElapsedSeconds?: number;
    },
  ) {
    const completionKey = createTimerCompletionKey(todo.id, event);
    if (processedTimerCompletionKeysRef.current.has(completionKey)) {
      return null;
    }
    processedTimerCompletionKeysRef.current.add(completionKey);

    const source =
      selectedTodo?.id === todo.id && selectedTodaySource
        ? selectedTodaySource
        : findTodaySourceForTimerSubject(todo.id);

    const elapsedMinutes =
      typeof event.activeElapsedSeconds === "number"
        ? Math.max(1, Math.round(event.activeElapsedSeconds / 60))
        : Math.max(1, Math.round((Date.now() - event.startedAt) / 60000));

    if (source?.type === "calendar-instance") {
      const replacement: CalendarEntry = {
        id: source.entryId,
        todo: { ...todo, projectId: undefined },
        printedAt: new Date().toISOString(),
        timerCompleted: event.completed,
        isTrackingEntry: true,
        timeSpent: {
          elapsed: elapsedMinutes,
        },
      };

      await replaceCalendarEntryInStorage(source.entryId, replacement);
      await dismissTodaySource(source);
      if (selectedTodo?.id === todo.id) {
        setSelectedTodo(null);
        setSelectedTodoSource({ type: "todo" });
        setSelectedTodaySource(null);
      }
      return replacement;
    }

    const entry = await addTimerEntryToCalendar({
      todo,
      completed: event.completed,
      startedAt: event.startedAt,
      elapsedSeconds: event.activeElapsedSeconds,
    });

    if (entry) {
      setCalendarEntries((prev) => {
        const alreadyExists = prev.some((existing) => existing.id === entry.id);
        if (alreadyExists) return prev;
        return [...prev, entry];
      });
    }

    if (source?.type === "archived-repeat") {
      await dismissTodaySource(source);
    }

    if (source?.type === "active") {
      if (shouldArchiveCompletedActiveTodo(todo)) {
        archiveTodo(source.todoId);
      } else {
        removeTodo(source.todoId);
      }
    }

    if (source && selectedTodo?.id === todo.id) {
      setSelectedTodo(null);
      setSelectedTodoSource({ type: "todo" });
      setSelectedTodaySource(null);
    }

    return entry;
  }

  function createTimerCompletionKey(
    todoId: number,
    event: {
      completed: boolean;
      startedAt: number;
      activeElapsedSeconds?: number;
    },
  ) {
    return [
      String(todoId),
      Math.trunc(Number(event.startedAt) || 0),
      Math.trunc(Number(event.activeElapsedSeconds) || 0),
      event.completed ? "completed" : "stopped",
    ].join(":");
  }

  const selectTodoByTargetId = useCallback(
    (rawTargetId: number | string, options: { preferTimerView?: boolean } = {}) => {
      const targetId = String(rawTargetId);
      const numericTargetId = Number(targetId);
      const absoluteTargetId = Number.isFinite(numericTargetId)
        ? Math.abs(Math.trunc(numericTargetId))
        : null;

      const todayItem = todayItems.find((item) => {
        if (String(item.todo.id) === targetId) return true;
        return (
          item.source.type === "calendar-instance" &&
          absoluteTargetId !== null &&
          item.source.entryId === absoluteTargetId
        );
      });

      if (todayItem) {
        setSideContext("notes");
        setActiveView(options.preferTimerView ? "timer" : "notes");
        setShowSettings(false);
        setIsNoteFullscreen(false);
        handleSelectProject(null);
        handleSelectTodayItem(todayItem);
        return true;
      }

      const projectTodo = todos.find(
        (todo) => String(todo.id) === targetId && todo.projectId,
      );
      if (projectTodo?.projectId) {
        const project = projects.find(
          (projectItem) => projectItem.id === projectTodo.projectId,
        );
        if (project) {
          setSideContext("projects");
          setActiveView(options.preferTimerView ? "timer" : "projects");
          setShowSettings(false);
          setIsNoteFullscreen(false);
          handleSelectProject(project);
          handleSelectTodo(projectTodo, { type: "todo" });
          return true;
        }
      }

      const projectArchivedTodo = archivedTodos.find(
        (todo) => String(todo.id) === targetId && todo.projectId,
      );
      if (projectArchivedTodo?.projectId) {
        const project = projects.find(
          (projectItem) => projectItem.id === projectArchivedTodo.projectId,
        );
        if (project) {
          setSideContext("projects");
          setActiveView(options.preferTimerView ? "timer" : "projects");
          setShowSettings(false);
          setIsNoteFullscreen(false);
          handleSelectProject(project);
          handleSelectTodo(projectArchivedTodo, { type: "archive" });
          return true;
        }
      }

      const projectCalendarEntry = calendarEntries.find((entry) => {
        if (!entry.todo.projectId) return false;
        if (String(entry.todo.id) === targetId) return true;
        return absoluteTargetId !== null && entry.id === absoluteTargetId;
      });
      if (projectCalendarEntry?.todo.projectId) {
        const project = projects.find(
          (projectItem) => projectItem.id === projectCalendarEntry.todo.projectId,
        );
        if (project) {
          setSideContext("projects");
          setActiveView(options.preferTimerView ? "timer" : "projects");
          setShowSettings(false);
          setIsNoteFullscreen(false);
          handleSelectProject(project);
          handleSelectTodo(projectCalendarEntry.todo, {
            type: "calendar",
            entryId: projectCalendarEntry.id,
          });
          return true;
        }
      }

      const archivedTodo = archivedTodos.find(
        (todo) => String(todo.id) === targetId,
      );
      if (archivedTodo) {
        setActiveView(options.preferTimerView ? "timer" : "archive");
        setShowSettings(false);
        setIsNoteFullscreen(false);
        handleSelectProject(null);
        handleSelectTodo(archivedTodo, { type: "archive" });
        return true;
      }

      const calendarEntry = calendarEntries.find((entry) => {
        if (String(entry.todo.id) === targetId) return true;
        return absoluteTargetId !== null && entry.id === absoluteTargetId;
      });
      if (calendarEntry) {
        setActiveView(options.preferTimerView ? "timer" : "calendar");
        setShowSettings(false);
        setIsNoteFullscreen(false);
        handleSelectProject(null);
        handleSelectTodo(calendarEntry.todo, {
          type: "calendar",
          entryId: calendarEntry.id,
        });
        setSelectedDate(
          new Date(calendarEntry.printedAt).toISOString().split("T")[0],
        );
        return true;
      }

      const looseTodo = todos.find((todo) => String(todo.id) === targetId);
      if (looseTodo) {
        setSideContext("notes");
        setActiveView(options.preferTimerView ? "timer" : "notes");
        setShowSettings(false);
        setIsNoteFullscreen(false);
        handleSelectProject(null);
        handleSelectTodo(looseTodo, { type: "todo" });
        return true;
      }

      return false;
    },
    [
      archivedTodos,
      calendarEntries,
      handleSelectProject,
      handleSelectTodayItem,
      handleSelectTodo,
      projects,
      todayItems,
      todos,
    ],
  );

  const syncRunningTodoSelection = useCallback(async () => {
    if (!TimerModule?.getTimerState) return false;

    try {
      const state = await TimerModule.getTimerState();

      if (!state?.isRunning) return false;

      return selectTodoByTargetId(state.todoId, { preferTimerView: true });
    } catch (error) {
      console.warn("Failed to sync running timer selection", error);
    }

    return false;
  }, [selectTodoByTargetId]);

  const syncNotificationTarget = useCallback(async () => {
    if (!TimerModule?.getNotificationTarget) return false;

    try {
      const target: NotificationTarget | null =
        await TimerModule.getNotificationTarget();

      if (!target?.todoId) return false;

      if (selectTodoByTargetId(target.todoId)) {
        TimerModule.clearNotificationTarget?.();
        return true;
      }

      TimerModule.clearNotificationTarget?.();
      return false;
    } catch (error) {
      console.warn("Failed to sync notification target", error);
      return false;
    }
  }, [selectTodoByTargetId]);

  function updateTimerSubject(rawId: number | string, updates: Partial<Todo>) {
    const id = String(rawId);
    const currentTodo = todosRef.current.find((todo) => String(todo.id) === id);

    if (currentTodo) {
      updateTodo(currentTodo.id, updates);
      return;
    }

    const archivedTodo = archivedTodosRef.current.find(
      (todo) => String(todo.id) === id,
    );

    if (archivedTodo) {
      updateArchivedTodo(archivedTodo.id, updates);
      return;
    }

    const calendarEntry = calendarEntriesRef.current.find(
      (entry) => String(entry.todo.id) === id,
    );

    if (calendarEntry) {
      updateCalendarEntryTodo(calendarEntry.id, updates);
      return;
    }

    const project = projectsRef.current.find(
      (projectItem) => String(projectItem.id) === id,
    );

    if (project) {
      updateProject(project.id, {
        timerMode: updates.timerMode,
        timer: updates.timer,
      });
    }
  }

  useEffect(() => {
    if (!todosLoaded || !didRestoreSelectedTodo) return;
    if (didSyncRunningSelectionOnLoadRef.current) return;

    didSyncRunningSelectionOnLoadRef.current = true;
    syncNotificationTarget();
    const retryTimeout = setTimeout(() => {
      syncNotificationTarget();
    }, 450);

    return () => clearTimeout(retryTimeout);
  }, [
    didRestoreSelectedTodo,
    syncNotificationTarget,
    todosLoaded,
  ]);

  useEffect(() => {
    const previousActiveView = previousActiveViewRef.current;
    previousActiveViewRef.current = activeView;

    const shouldSyncRunningSelection =
      activeView === "timer" && previousActiveView !== "timer";

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
        nextAppState === "active"
      ) {
        syncNotificationTarget().then((handledTarget) => {
          if (
            !handledTarget &&
            activeViewRef.current === "timer"
          ) {
            syncRunningTodoSelection();
          }
        });
      }
    });

    return () => subscription.remove();
  }, [syncNotificationTarget, syncRunningTodoSelection]);

  const handleAddTodo = async () => {
    if (activeView === "settings") {
      return undefined;
    }

    if (activeView === "projects") {
      if (selectedProject) {
        const newTodo = addTodo({
          projectId: selectedProject.id,
          color: selectedProject.color,
        });
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
    if (
      selectedTodaySource?.type === "calendar-instance" &&
      selectedTodo?.id === todo.id
    ) {
      const replacement: CalendarEntry = {
        id: selectedTodaySource.entryId,
        todo: { ...todo, projectId: undefined },
        printedAt: new Date().toISOString(),
        isTrackingEntry: true,
      };

      await replaceCalendarEntryInStorage(
        selectedTodaySource.entryId,
        replacement,
      );
      await dismissSelectedTodayOccurrence();
      return;
    }

    const calendarEntry: CalendarEntry = {
      id: Date.now(),
      todo: { ...todo, projectId: undefined },
      printedAt: new Date().toISOString(),
      isTrackingEntry: true,
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

    setCalendarEntries((prev) => [...prev, calendarEntry]);

    if (
      selectedTodaySource?.type === "archived-repeat" &&
      selectedTodo?.id === todo.id
    ) {
      await dismissSelectedTodayOccurrence();
      return;
    }

    if (
      selectedTodaySource?.type === "active" &&
      selectedTodo?.id === todo.id
    ) {
      if (shouldArchiveCompletedActiveTodo(todo)) {
        archiveTodo(selectedTodaySource.todoId);
      } else {
        removeTodo(selectedTodaySource.todoId);
      }
      setSelectedTodo(null);
      setSelectedTodoSource({ type: "todo" });
      setSelectedTodaySource(null);
    }
  };

  const handleCalendarAddEntry = async () => {
    const entry = await handleAddTodo();
    return entry as Todo | CalendarEntry | undefined;
  };

  const handleRemoveTodo = (id: number): Todo | null => {
    if (selectedTodo?.id === id && selectedTodoSource.type === "calendar") {
      const updatedEntries = calendarEntriesRef.current.filter(
        (entry) => entry.id !== selectedTodoSource.entryId,
      );

      setCalendarEntries(updatedEntries);
      AsyncStorage.setItem(
        "calendarEntries",
        JSON.stringify(updatedEntries),
      ).catch((error) => {
        console.error("Error deleting calendar entry:", error);
      });

      setSelectedTodo(null);
      setSelectedTodoSource({ type: "todo" });
      setSelectedTodaySource(null);
      return null;
    }

    if (selectedTodo?.id === id && selectedTodoSource.type === "archive") {
      setArchivedTodos((prevTodos) =>
        prevTodos.filter((todo) => todo.id !== id),
      );
      setSelectedTodo(null);
      setSelectedTodoSource({ type: "todo" });
      setSelectedTodaySource(null);
      return null;
    }

    const nextTodo = removeTodo(id);
    handleSelectTodo(nextTodo, { type: "todo" });
    return nextTodo;
  };

  const handleArchiveTodo = (id: number): Todo | null => {
    if (
      selectedTodo?.id === id &&
      (selectedTodaySource?.type === "archived-repeat" ||
        selectedTodaySource?.type === "calendar-instance")
    ) {
      dismissSelectedTodayOccurrence();
      return null;
    }

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
            projects={projects}
          />
        </View>
      );
    }

    const leftColumnMode: SideContext =
      activeView === "projects"
        ? "projects"
        : activeView === "notes"
          ? "notes"
          : sideContext;

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
          {leftColumnMode === "projects" ? (
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
              setSelectedProject={(project) => {
                setShowSettings(false);
                handleSelectProject(project);
              }}
              setSelectedTodo={(todo, source) => {
                setShowSettings(false);
                handleSelectTodo(todo, source);
              }}
            />
          ) : (
            <TodoList
              todos={
                leftColumnMode === "notes"
                  ? orderedTodayItems.map((item) => item.todo)
                  : todos
              }
              setTodos={setTodos}
              updateTodo={
                leftColumnMode === "notes" ? updateTodayTodo : updateTodo
              }
              selectedTodo={selectedTodo}
              setSelectedTodo={(todo) => {
                handleSelectProject(null);
                if (leftColumnMode === "notes" && todo) {
                  const todayItem = orderedTodayItems.find(
                    (item) => item.todo === todo || item.todo.id === todo.id,
                  );

                  if (todayItem) {
                    handleSelectTodayItem(todayItem);
                    return;
                  }
                }

                handleSelectTodo(todo, { type: "todo" });
              }}
              getTodoKey={(todo) => {
                if (leftColumnMode !== "notes") return String(todo.id);

                return (
                  orderedTodayItems.find(
                    (item) => item.todo === todo || item.todo.id === todo.id,
                  )
                    ?.occurrenceKey ?? String(todo.id)
                );
              }}
              onReorderTodos={
                leftColumnMode === "notes" ? handleTodayReorder : undefined
              }
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
            selectedTodo={
              activeView === "timer" ? currentTimerTodo : currentSelectedTodo
            }
            selectedTodoSource={selectedTodoSource}
            selectedProject={currentSelectedProject}
            activeView={activeView}
            isNoteFullscreen={isNoteFullscreen}
            updateTodo={
              activeView === "timer" ? handleTimerItemUpdate : updateTodo
            }
            updateCalendarEntryTodo={updateCalendarEntryTodo}
            updateProject={updateProject}
            removeProject={(id) => {
              removeProject(id);
              clearCalendarProject(id);
              handleSelectProject(null);
              handleSelectTodo(null);
            }}
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
            todayItems={todayItems}
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
    handleSelectProject(null);
    handleSelectTodo(null);
    const nextContext = activeView === "projects" ? "notes" : "projects";
    setSideContext(nextContext);
    setActiveView(nextContext);
  };

  const handleTopBarViewChange = (view: ViewType) => {
    if (view !== activeView || view !== "notes") {
      setIsNoteFullscreen(false);
    }

    if (view === "notes") {
      const lastDocsView = sideContext;

      if (activeView === lastDocsView) {
        setShowSettings((current) => !current);
        return;
      }

      setShowSettings(false);
      setActiveView(lastDocsView);

      if (lastDocsView === "notes") {
        handleSelectProject(null);
      }

      return;
    }

    if (view === "projects") {
      setSideContext("projects");
    }

    if (view === "calendar" || view === "settings") {
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
  const currentTimerTodo =
    currentSelectedTodo ??
    (currentSelectedProject
      ? getProjectAsTimerTodo(currentSelectedProject)
      : null);

  const handleTimerItemUpdate = (id: number, updates: Partial<Todo>) => {
    updateTimerSubject(id, updates);
  };

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
