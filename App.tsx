import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  View,
  LogBox,
  NativeModules,
  NativeEventEmitter,
  Vibration,
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
import { addTimerEntryToCalendar } from "./utils/calendarStorage";

const { TimerModule } = NativeModules;

// Ignore the specific warning about defaultProps
LogBox.ignoreLogs(["Warning: ExpandableCalendar: Support for defaultProps"]);

type ViewType = "notes" | "settings" | "archive" | "calendar";
type CalendarViewMode = "day" | "week";

const App = () => {
  const [activeView, setActiveView] = useState<ViewType>("notes");
  const [showSettings, setShowSettings] = useState(false);
  const [calendarViewMode, setCalendarViewMode] =
    useState<CalendarViewMode>("day");
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const {
    todos,
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
    todosRef.current = todos;
  }, [todos]);

  useEffect(() => {
    if (!TimerModule) return;

    const emitter = new NativeEventEmitter(TimerModule);

    const subscription = emitter.addListener(
      "TIMER_FINISHED",
      async (event) => {
        TimerModule.clearPendingCompletion?.();

        if (event.completed) {
          Vibration.vibrate([0, 500, 200, 500]);
        }

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
        setSelectedTodo(runningTodo);
      }
    };

    syncRunningTodoSelection();
  }, [activeView, todos]);

  const handleAddTodo = async () => {
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
      setSelectedTodo(newTodo);
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
    setSelectedTodo(nextTodo);
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
        <View style={styles.todoListContainer}>
          <TodoList
            todos={todos}
            setTodos={setTodos}
            updateTodo={updateTodo}
            selectedTodo={selectedTodo}
            setSelectedTodo={setSelectedTodo}
          />
        </View>
        <View style={styles.todoNoteColumnContainer}>
          <TodoNoteColumn
            selectedTodo={currentSelectedTodo}
            activeView={activeView}
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
          />
        </View>
      </View>
    );
  };

  const handleCalendarPress = () => {
    if (activeView !== "calendar") {
      setActiveView("calendar");
    } else {
      setCalendarViewMode((prev) => (prev === "day" ? "week" : "day"));
    }
  };

  const currentSelectedTodo = selectedTodo
    ? (todos.find((todo) => todo.id === selectedTodo.id) ?? selectedTodo)
    : null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <TopBar
          onAddTodo={handleAddTodo}
          activeView={activeView}
          setActiveView={setActiveView}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          onCalendarPress={handleCalendarPress}
        />
        {renderMainContent()}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  content: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  todoListContainer: {
    width: "40%",
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
