import React, { useRef, useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import TodoItemNote from "./TodoItemNote";
import TodoSettings from "./TodoSettings";
import TimerView from "./TimerView";
import ArchivedTodos from "./ArchivedTodos";
import AppSettings from "./AppSettings";
import ProjectSettings from "./ProjectSettings";
import {
  Project,
  Todo,
  TrashedTodo,
  TrashRetention,
  TodayTodoItem,
} from "../types";

interface TodoNoteColumnProps {
  selectedTodo: Todo | null;
  selectedTodoSource:
    | { type: "todo" }
    | { type: "archive" }
    | { type: "calendar"; entryId: number };
  selectedProject: Project | null;
  activeView:
    | "notes"
    | "projects"
    | "timer"
    | "settings"
    | "archive"
    | "calendar";
  isNoteFullscreen: boolean;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
  updateCalendarEntryTodo: (
    entryId: number,
    updates: Partial<Todo>,
  ) => Promise<void>;
  updateProject: (id: number, updates: Partial<Project>) => void;
  removeProject: (id: number) => void;
  removeTodo: (id: number) => Todo | null;
  archiveTodo: (id: number) => Todo | null;
  archivedTodos: Todo[];
  setArchivedTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  unarchiveTodo: (id: number) => void;
  updateArchivedTodo: (id: number, updates: Partial<Todo>) => void;
  showSettings: boolean;
  trashedTodos: TrashedTodo[];
  trashRetention: TrashRetention;
  restoreTrashedTodo: (id: number) => void;
  deleteTrashedTodo: (id: number) => void;
  emptyTrash: () => void;
  setTrashRetention: (retention: TrashRetention) => void;
  printOnCalendar: (todo: Todo) => void;
  exportData: () => void;
  importData: () => void;
  todos: Todo[];
  projects: Project[];
  todayItems?: TodayTodoItem[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>; // Add this line
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
}

const TodoNoteColumn: React.FC<TodoNoteColumnProps> = ({
  selectedTodo,
  selectedTodoSource,
  selectedProject,
  activeView,
  isNoteFullscreen,
  updateTodo,
  updateCalendarEntryTodo,
  updateProject,
  removeProject,
  removeTodo,
  archiveTodo,
  archivedTodos,
  setArchivedTodos,
  unarchiveTodo,
  updateArchivedTodo,
  showSettings,
  trashedTodos,
  trashRetention,
  restoreTrashedTodo,
  deleteTrashedTodo,
  emptyTrash,
  setTrashRetention,
  printOnCalendar,
  exportData,
  importData,
  todos,
  projects,
  todayItems = [],
  setTodos,
  setShowSettings,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollFrameViewRef = useRef<View>(null);
  const settingsTopRef = useRef(0);
  const scrollYRef = useRef(0);
  const scrollFrameRef = useRef({ pageY: 0, height: 0 });
  const scrollContentHeightRef = useRef(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isListDragging, setIsListDragging] = useState(false);
  const [localSelectedTodo, setLocalSelectedTodo] = useState<Todo | null>(
    selectedTodo,
  );

  React.useEffect(() => {
    setLocalSelectedTodo(selectedTodo);
  }, [selectedTodo]);

  React.useEffect(() => {
    if (!showSettings || (activeView !== "notes" && activeView !== "projects")) {
      return;
    }

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

      if (selectedTodoSource.type === "archive") {
        updateArchivedTodo(updatedTodo.id, updates);
      } else if (selectedTodoSource.type === "calendar") {
        updateCalendarEntryTodo(selectedTodoSource.entryId, updates);
      } else {
        updateTodo(updatedTodo.id, updates);
      }
    }
  };

  const measureScrollFrame = () => {
    scrollFrameViewRef.current?.measureInWindow((_, pageY, __, height) => {
      scrollFrameRef.current = { pageY, height };
    });
  };

  const handleListDragChange = (isDragging: boolean) => {
    setIsListDragging(isDragging);

    if (isDragging) {
      measureScrollFrame();
    }
  };

  const handleListDragMove = (pageY: number) => {
    const frame = scrollFrameRef.current;
    if (frame.height <= 0) return 0;

    const maxScrollY = Math.max(
      0,
      scrollContentHeightRef.current - frame.height,
    );
    const edgeSize = 64;
    const distanceFromTop = pageY - frame.pageY;
    const distanceFromBottom = frame.pageY + frame.height - pageY;
    let delta = 0;

    if (distanceFromTop < edgeSize) {
      const pressure = Math.max(0, edgeSize - distanceFromTop) / edgeSize;
      delta = -Math.max(2, Math.round(pressure * 5));
    } else if (distanceFromBottom < edgeSize) {
      const pressure = Math.max(0, edgeSize - distanceFromBottom) / edgeSize;
      delta = Math.max(2, Math.round(pressure * 5));
    }

    if (delta === 0) return 0;

    const nextY = Math.max(0, Math.min(maxScrollY, scrollYRef.current + delta));
    const appliedDelta = nextY - scrollYRef.current;

    if (appliedDelta === 0) return 0;

    scrollYRef.current = nextY;
    scrollViewRef.current?.scrollTo({ y: nextY, animated: false });
    return appliedDelta;
  };

  const renderContent = () => {
    if (activeView === "timer") {
      return <TimerView selectedTodo={selectedTodo} updateTodo={updateTodo} />;
    }

    if (activeView === "projects") {
      if (localSelectedTodo) {
        return (
          <>
            <TodoItemNote
              todo={localSelectedTodo}
              showTitle={isNoteFullscreen}
              updateNote={(noteText: string) =>
                handleTodoUpdate({ note: noteText })
              }
              onStartEditing={() => {
                setIsEditing(true);
                setShowSettings(false);
              }}
              onEndEditing={() => setIsEditing(false)}
              onListDragChange={handleListDragChange}
              onListDragMove={handleListDragMove}
            />
            {showSettings && (
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
                  projects={projects}
                  updateTodo={handleTodoUpdate}
                  removeTodo={() => {
                    if (localSelectedTodo) {
                      const nextTodo = removeTodo(localSelectedTodo.id);
                      setLocalSelectedTodo(nextTodo);
                    }
                  }}
                  archiveTodo={() => {
                    if (localSelectedTodo) {
                      const nextTodo = archiveTodo(localSelectedTodo.id);
                      setLocalSelectedTodo(nextTodo);
                    }
                  }}
                  printOnCalendar={printOnCalendar}
                />
              </View>
            )}
          </>
        );
      }

      if (!selectedProject) return null;

      return (
        <>
          <TodoItemNote
            todo={{
              id: selectedProject.id,
              text: selectedProject.title,
              note: selectedProject.note,
              color: selectedProject.color,
              isEditing: false,
              noteType: "text",
              createdAt: selectedProject.createdAt,
            }}
            showTitle
            updateNote={(noteText: string) =>
              updateProject(selectedProject.id, { note: noteText })
            }
            onStartEditing={() => setIsEditing(true)}
            onEndEditing={() => setIsEditing(false)}
            onListDragChange={handleListDragChange}
            onListDragMove={handleListDragMove}
          />
          {showSettings && (
            <ProjectSettings
              project={selectedProject}
              updateProject={(updates) =>
                updateProject(selectedProject.id, updates)
              }
              removeProject={() => removeProject(selectedProject.id)}
            />
          )}
        </>
      );
    }

    if (activeView === "settings") {
      return (
        <AppSettings
          deleteTrashedTodo={deleteTrashedTodo}
          emptyTrash={emptyTrash}
          exportData={exportData}
          importData={importData}
          restoreTrashedTodo={restoreTrashedTodo}
          setTrashRetention={setTrashRetention}
          trashedTodos={trashedTodos}
          trashRetention={trashRetention}
        />
      );
    }

    if (activeView === "archive") {
      return (
        <ArchivedTodos
          archivedTodos={archivedTodos}
          hiddenArchivedTodoIds={todayItems
            .filter((item) => item.source.type === "archived-repeat")
            .map((item) => item.source.todoId)}
          setArchivedTodos={setArchivedTodos}
          unarchiveTodo={unarchiveTodo}
          updateArchivedTodo={updateArchivedTodo}
          updateTodo={updateTodo}
          todos={todos}
          setTodos={setTodos}
          isExpanded={isNoteFullscreen}
          onNoteBodyDragChange={handleListDragChange}
          onNoteBodyDragMove={handleListDragMove}
        />
      );
    }

    return (
      localSelectedTodo && (
        <>
          <TodoItemNote
            todo={localSelectedTodo}
            showTitle={isNoteFullscreen}
            updateNote={(noteText: string) =>
              handleTodoUpdate({ note: noteText })
            }
            onStartEditing={() => {
              setIsEditing(true);
              setShowSettings(false);
            }}
            onEndEditing={() => setIsEditing(false)}
            onListDragChange={handleListDragChange}
            onListDragMove={handleListDragMove}
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
                projects={projects}
                updateTodo={handleTodoUpdate}
                removeTodo={() => {
                  if (localSelectedTodo) {
                    const nextTodo = removeTodo(localSelectedTodo.id);
                    setLocalSelectedTodo(nextTodo);
                  }
                }}
                archiveTodo={() => {
                  if (localSelectedTodo) {
                    const nextTodo = archiveTodo(localSelectedTodo.id);
                    setLocalSelectedTodo(nextTodo);
                  }
                }}
                printOnCalendar={printOnCalendar}
              />
            </View>
          )}
        </>
      )
    );
  };

  return (
    <View
      ref={scrollFrameViewRef}
      onLayout={measureScrollFrame}
      style={[
        styles.container,
        isNoteFullscreen &&
          (activeView === "notes" || activeView === "archive") &&
          (activeView === "archive"
            ? styles.archiveFullscreenContainer
            : styles.fullscreenContainer),
      ]}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        scrollEnabled={!isListDragging}
        onScroll={(event) => {
          scrollYRef.current = event.nativeEvent.contentOffset.y;
        }}
        onContentSizeChange={(_, height) => {
          scrollContentHeightRef.current = height;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={
          isNoteFullscreen && activeView === "notes"
            ? styles.fullscreenScrollContent
            : undefined
        }
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
  fullscreenContainer: {
    paddingLeft: 12,
    paddingRight: 12,
    paddingBottom: 12,
  },
  archiveFullscreenContainer: {
    paddingLeft: 4,
    paddingRight: 4,
    paddingBottom: 12,
  },
  scrollView: {
    flex: 1,
  },
  fullscreenScrollContent: {
    flexGrow: 1,
  },
  settingsContainer: {
    marginTop: 8,
    paddingTop: 12,
  },
});

export default TodoNoteColumn;
