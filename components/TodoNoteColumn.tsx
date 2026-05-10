import React, { useRef, useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import TodoItemNote from "./TodoItemNote";
import TodoSettings from "./TodoSettings";
import TimerView from "./TimerView";
import ArchivedTodos from "./ArchivedTodos";
import AppSettings from "./AppSettings";
import { Todo } from "../types";

interface TodoNoteColumnProps {
  selectedTodo: Todo | null;
  activeView: "notes" | "timer" | "settings" | "archive" | "calendar";
  updateTodo: (id: number, updates: Partial<Todo>) => void;
  removeTodo: (id: number) => Todo | null;
  archiveTodo: (id: number) => void;
  archivedTodos: Todo[];
  setArchivedTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  unarchiveTodo: (id: number) => void;
  updateArchivedTodo: (id: number, updates: Partial<Todo>) => void;
  showSettings: boolean;
  printOnCalendar: (todo: Todo) => void;
  exportData: () => void;
  importData: () => void;
  todos: Todo[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>; // Add this line
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
}

const TodoNoteColumn: React.FC<TodoNoteColumnProps> = ({
  selectedTodo,
  activeView,
  updateTodo,
  removeTodo,
  archiveTodo,
  archivedTodos,
  setArchivedTodos,
  unarchiveTodo,
  updateArchivedTodo,
  showSettings,
  printOnCalendar,
  exportData,
  importData,
  todos,
  setTodos,
  setShowSettings,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const settingsTopRef = useRef(0);
  const [isEditing, setIsEditing] = useState(false);
  const [localSelectedTodo, setLocalSelectedTodo] = useState<Todo | null>(
    selectedTodo,
  );

  React.useEffect(() => {
    setLocalSelectedTodo(selectedTodo);
  }, [selectedTodo]);

  React.useEffect(() => {
    if (!showSettings || activeView !== "notes") return;

    const scrollTimeout = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: settingsTopRef.current,
        animated: true,
      });
    }, 80);

    return () => clearTimeout(scrollTimeout);
  }, [activeView, selectedTodo?.id, showSettings]);

  const handleTodoUpdate = (updates: Partial<Todo>) => {
    if (localSelectedTodo) {
      const updatedTodo = { ...localSelectedTodo, ...updates };
      setLocalSelectedTodo(updatedTodo);
      updateTodo(updatedTodo.id, updates);
    }
  };

  const renderContent = () => {
    if (activeView === "timer") {
      return <TimerView selectedTodo={selectedTodo} updateTodo={updateTodo} />;
    }

    if (activeView === "settings") {
      return <AppSettings />;
    }

    if (activeView === "archive") {
      return (
        <ArchivedTodos
          archivedTodos={archivedTodos}
          setArchivedTodos={setArchivedTodos}
          unarchiveTodo={unarchiveTodo}
          updateArchivedTodo={updateArchivedTodo}
          exportData={exportData}
          importData={importData}
          showSettings={showSettings}
          updateTodo={updateTodo}
          todos={todos}
          setTodos={setTodos}
        />
      );
    }

    return (
      localSelectedTodo && (
        <>
          <TodoItemNote
            todo={localSelectedTodo}
            updateNote={(noteText: string) =>
              handleTodoUpdate({ note: noteText })
            }
            onStartEditing={() => {
              setIsEditing(true);
              setShowSettings(false);
            }}
            onEndEditing={() => setIsEditing(false)}
          />
          {activeView === "notes" && showSettings && (
            <View
              style={styles.settingsContainer}
              onLayout={(event) => {
                settingsTopRef.current = Math.max(
                  0,
                  event.nativeEvent.layout.y - 4,
                );
                scrollViewRef.current?.scrollTo({
                  y: settingsTopRef.current,
                  animated: true,
                });
              }}
            >
              <TodoSettings
                todo={localSelectedTodo}
                updateTodo={handleTodoUpdate}
                removeTodo={() => {
                  if (localSelectedTodo) {
                    const nextTodo = removeTodo(localSelectedTodo.id);
                    setLocalSelectedTodo(nextTodo);
                  }
                }}
                archiveTodo={() => archiveTodo(localSelectedTodo.id)}
                printOnCalendar={printOnCalendar}
              />
            </View>
          )}
        </>
      )
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
      >
        {renderContent()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
    paddingRight: 2,
  },
  scrollView: {
    flex: 1,
  },
  settingsContainer: {
    marginTop: 8,
    paddingTop: 12,
  },
});

export default TodoNoteColumn;
