import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PanGestureHandler } from "react-native-gesture-handler";
import ProjectItem, { ProjectItemRef } from "./ProjectItem";
import TodoItem, { TodoItemRef } from "./TodoItem";
import { CalendarEntry, Project, Todo } from "../types";
import { useTodoListDrag } from "../hooks/useTodoListDrag";

type ProjectTodoSource =
  | { type: "todo" }
  | { type: "archive" }
  | { type: "calendar"; entryId: number };

type ProjectTodoRow = {
  todo: Todo;
  source: ProjectTodoSource;
};

const PROJECT_ORDER_KEY_PREFIX = "projectOrder:";

interface ProjectListProps {
  projects: Project[];
  todos: Todo[];
  archivedTodos: Todo[];
  calendarEntries: CalendarEntry[];
  selectedProject: Project | null;
  selectedTodo: Todo | null;
  selectedTodoSource: ProjectTodoSource;
  updateProject: (id: number, updates: Partial<Project>) => void;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
  updateArchivedTodo: (id: number, updates: Partial<Todo>) => void;
  updateCalendarEntryTodo: (
    entryId: number,
    updates: Partial<Todo>,
  ) => Promise<void>;
  setSelectedProject: (project: Project | null) => void;
  setSelectedTodo: (todo: Todo | null, source?: ProjectTodoSource) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  todos,
  archivedTodos,
  calendarEntries,
  selectedProject,
  selectedTodo,
  selectedTodoSource,
  updateProject,
  updateTodo,
  updateArchivedTodo,
  updateCalendarEntryTodo,
  setSelectedProject,
  setSelectedTodo,
}) => {
  const projectRefs = useRef<{ [key: number]: ProjectItemRef }>({});
  const todoRefs = useRef<{ [key: number]: TodoItemRef }>({});

  const stopOtherEdits = (currentId?: number, type?: "project" | "todo") => {
    Object.entries(projectRefs.current).forEach(([id, ref]) => {
      if (type !== "project" || Number(id) !== currentId) {
        ref.stopEditing();
      }
    });

    Object.entries(todoRefs.current).forEach(([id, ref]) => {
      if (type !== "todo" || Number(id) !== currentId) {
        ref.stopEditing();
      }
    });
  };

  const handleProjectSelect = (project: Project) => {
    stopOtherEdits(project.id, "project");

    if (selectedProject?.id === project.id) {
      setSelectedProject(null);
      setSelectedTodo(null);
      return;
    }

    setSelectedProject(project);
    setSelectedTodo(null);
  };

  const handleTodoSelect = (row: ProjectTodoRow) => {
    const { todo, source } = row;

    stopOtherEdits(todo.id, "todo");
    setSelectedTodo(todo, source);
  };

  const getProjectRows = (projectId: number): ProjectTodoRow[] => {
    const currentRows = todos
      .filter((todo) => todo.projectId === projectId)
      .map((todo) => ({ todo, source: { type: "todo" as const } }));
    const archivedRows = archivedTodos
      .filter((todo) => todo.projectId === projectId)
      .map((todo) => ({ todo, source: { type: "archive" as const } }));
    const calendarRows = calendarEntries
      .filter((entry) => entry.todo.projectId === projectId)
      .map((entry) => ({
        todo: entry.todo,
        source: { type: "calendar" as const, entryId: entry.id },
      }));

    return [...currentRows, ...archivedRows, ...calendarRows];
  };

  const isSelectedRow = (row: ProjectTodoRow) => {
    if (selectedTodo?.id !== row.todo.id) return false;
    if (selectedTodoSource.type !== row.source.type) return false;
    if (
      selectedTodoSource.type === "calendar" &&
      row.source.type === "calendar"
    ) {
      return selectedTodoSource.entryId === row.source.entryId;
    }

    return true;
  };

  const updateRowTodo = (row: ProjectTodoRow, updates: Partial<Todo>) => {
    if (row.source.type === "archive") {
      updateArchivedTodo(row.todo.id, updates);
      return;
    }

    if (row.source.type === "calendar") {
      updateCalendarEntryTodo(row.source.entryId, updates);
      return;
    }

    updateTodo(row.todo.id, updates);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {projects.map((project) => {
          const isSelected = selectedProject?.id === project.id;
          const childRows = isSelected ? getProjectRows(project.id) : [];

          return (
            <View key={project.id} style={styles.projectGroup}>
              <ProjectItem
                project={project}
                isSelected={isSelected}
                selectProject={() => handleProjectSelect(project)}
                updateProject={updateProject}
                stopOtherEdits={() => stopOtherEdits(project.id, "project")}
                ref={(ref) => {
                  if (ref) {
                    projectRefs.current[project.id] = ref;
                  }
                }}
              />
              {isSelected ? (
                <ProjectChildRows
                  projectId={project.id}
                  rows={childRows}
                  isSelectedRow={isSelectedRow}
                  onSelectRow={handleTodoSelect}
                  updateRowTodo={updateRowTodo}
                  stopOtherEdits={(todoId) => stopOtherEdits(todoId, "todo")}
                  setTodoRef={(todoId, ref) => {
                    if (ref) {
                      todoRefs.current[todoId] = ref;
                    }
                  }}
                />
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

interface ProjectChildRowsProps {
  projectId: number;
  rows: ProjectTodoRow[];
  isSelectedRow: (row: ProjectTodoRow) => boolean;
  onSelectRow: (row: ProjectTodoRow) => void;
  updateRowTodo: (row: ProjectTodoRow, updates: Partial<Todo>) => void;
  stopOtherEdits: (todoId: number) => void;
  setTodoRef: (todoId: number, ref: TodoItemRef | null) => void;
}

const ProjectChildRows: React.FC<ProjectChildRowsProps> = ({
  projectId,
  rows,
  isSelectedRow,
  onSelectRow,
  updateRowTodo,
  stopOtherEdits,
  setTodoRef,
}) => {
  const [orderKeys, setOrderKeys] = useState<string[] | null>(null);
  const orderedRows = useMemo(
    () => applyProjectOrder(rows, orderKeys),
    [orderKeys, rows],
  );
  const handleReorderRows = useCallback(
    (nextRows: ProjectTodoRow[]) => {
      const nextOrderKeys = nextRows.map(getProjectRowKey);

      setOrderKeys(nextOrderKeys);
      AsyncStorage.setItem(
        `${PROJECT_ORDER_KEY_PREFIX}${projectId}`,
        JSON.stringify(nextOrderKeys),
      ).catch((error) => {
        console.error("Failed to save project order:", error);
      });
    },
    [projectId],
  );
  const {
    draggedItemKey,
    pan,
    itemAnimations,
    onPanGestureEvent,
    onHandlerStateChange,
    handleLayout,
    onDragStart,
    setListLayout,
  } = useTodoListDrag(orderedRows, handleReorderRows, getProjectRowKey);

  useEffect(() => {
    const loadProjectOrder = async () => {
      try {
        const savedOrder = await AsyncStorage.getItem(
          `${PROJECT_ORDER_KEY_PREFIX}${projectId}`,
        );
        const parsedOrder = savedOrder ? JSON.parse(savedOrder) : null;

        setOrderKeys(
          Array.isArray(parsedOrder)
            ? parsedOrder.filter((key): key is string => typeof key === "string")
            : null,
        );
      } catch (error) {
        console.error("Failed to load project order:", error);
        setOrderKeys(null);
      }
    };

    loadProjectOrder();
  }, [projectId]);

  return (
    <View
      style={styles.projectChildList}
      onLayout={(event) => setListLayout(event.nativeEvent.layout)}
    >
      {orderedRows.map((row) => {
        const rowKey = getProjectRowKey(row);
        const isDragging = draggedItemKey === rowKey;
        const content = (
          <Animated.View
            key={rowKey}
            style={[
              styles.childTodoContainer,
              {
                transform: [
                  {
                    translateY: isDragging
                      ? pan.y
                      : itemAnimations[rowKey] || 0,
                  },
                ],
                zIndex: isDragging ? 999 : 1,
              },
            ]}
          >
            <TodoItem
              todo={row.todo}
              selectTodo={() => onSelectRow(row)}
              isSelected={isSelectedRow(row)}
              updateTodo={(_id, updates) => updateRowTodo(row, updates)}
              stopOtherEdits={() => stopOtherEdits(row.todo.id)}
              onDragStart={() => onDragStart(rowKey)}
              isDragging={isDragging}
              onLayout={(layout) => handleLayout(rowKey, layout)}
              horizontalMargin={12}
              ref={(ref) => setTodoRef(row.todo.id, ref)}
            />
          </Animated.View>
        );

        return (
          <PanGestureHandler
            key={rowKey}
            onGestureEvent={onPanGestureEvent}
            onHandlerStateChange={onHandlerStateChange}
            enabled={isDragging}
          >
            {content}
          </PanGestureHandler>
        );
      })}
    </View>
  );
};

const getProjectRowKey = (row: ProjectTodoRow) => {
  return `${row.source.type}-${
    row.source.type === "calendar" ? row.source.entryId : row.todo.id
  }`;
};

const applyProjectOrder = (
  rows: ProjectTodoRow[],
  orderKeys: string[] | null,
) => {
  if (!orderKeys || orderKeys.length === 0) return rows;

  const rowsByKey = new Map(rows.map((row) => [getProjectRowKey(row), row]));
  const orderedRows: ProjectTodoRow[] = [];

  for (const key of orderKeys) {
    const row = rowsByKey.get(key);
    if (!row) continue;

    orderedRows.push(row);
    rowsByKey.delete(key);
  }

  return [...orderedRows, ...rowsByKey.values()];
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginRight: 0,
  },
  scrollView: {
    flex: 1,
    paddingTop: 8,
  },
  projectGroup: {
    marginBottom: 3,
  },
  projectChildList: {
    overflow: "hidden",
  },
  childTodoContainer: {
    marginLeft: 4,
  },
});

export default ProjectList;
