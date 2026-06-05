import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PanGestureHandler } from "react-native-gesture-handler";
import ProjectItem, { ProjectItemRef } from "./ProjectItem";
import TodoItem, { TodoItemRef } from "./TodoItem";
import { CalendarEntry, Project, Todo } from "../types";
import { useTodoListDrag } from "../hooks/useTodoListDrag";
import {
  getProjectTodoRowKey,
  isSameProjectTodoId,
  isSameProjectTodoSource,
  ProjectTodoSource,
  shouldShowCalendarEntryInProject,
} from "../utils/projects";

type ProjectTodoRow = {
  todo: Todo;
  source: ProjectTodoSource;
  occurrenceIndex: number;
};

const PROJECT_ORDER_KEY_PREFIX = "projectOrder:";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

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
  const todoRefs = useRef<Record<string, TodoItemRef>>({});
  const [collapsedSelectedSubprojectId, setCollapsedSelectedSubprojectId] =
    useState<number | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);

  const animateProjectExpansion = () => {
    LayoutAnimation.configureNext({
      duration: 170,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  };

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
    animateProjectExpansion();
    stopOtherEdits(project.id, "project");
    setSelectedRowKey(null);

    if (selectedProject?.id === project.id) {
      if (project.parentProjectId) {
        setCollapsedSelectedSubprojectId((currentId) =>
          currentId === project.id ? null : project.id,
        );
      } else {
        setSelectedProject(null);
        setCollapsedSelectedSubprojectId(null);
      }
      setSelectedTodo(null);
      return;
    }

    setCollapsedSelectedSubprojectId(null);
    setSelectedProject(project);
    setSelectedTodo(null);
  };

  const handleTodoSelect = (row: ProjectTodoRow) => {
    animateProjectExpansion();
    const { todo, source } = row;
    const ownerProject = todo.projectId
      ? projects.find((project) => project.id === todo.projectId)
      : null;

    setCollapsedSelectedSubprojectId(null);
    setSelectedRowKey(getProjectRowKey(row));
    setSelectedProject(ownerProject ?? null);
    stopOtherEdits(todo.id, "todo");
    setSelectedTodo(todo, source);
  };

  const getProjectRows = (projectId: number): ProjectTodoRow[] => {
    const currentRows = todos
      .filter((todo) => todo.projectId === projectId)
      .map((todo, occurrenceIndex) => ({
        todo,
        source: { type: "todo" as const },
        occurrenceIndex,
      }));
    const archivedRows = archivedTodos
      .filter((todo) => todo.projectId === projectId)
      .map((todo, occurrenceIndex) => ({
        todo,
        source: { type: "archive" as const },
        occurrenceIndex,
      }));
    const calendarRows = calendarEntries
      .filter((entry) => shouldShowCalendarEntryInProject(entry, projectId))
      .map((entry, occurrenceIndex) => ({
        todo: entry.todo,
        source: { type: "calendar" as const, entryId: entry.id },
        occurrenceIndex,
      }));

    return [...currentRows, ...archivedRows, ...calendarRows];
  };

  const getSubprojects = (projectId: number) =>
    projects.filter((project) => project.parentProjectId === projectId);

  const subprojectsBelongsToProject = (
    projectItems: Project[],
    subprojectId: number,
    projectId: number,
  ) =>
    projectItems.some(
      (project) =>
        project.id === subprojectId && project.parentProjectId === projectId,
    );

  const isSelectedRow = (row: ProjectTodoRow) => {
    if (selectedRowKey === getProjectRowKey(row)) return true;
    if (!isSameProjectTodoId(selectedTodo?.id, row.todo.id)) return false;
    return isSameProjectTodoSource(selectedTodoSource, row.source);
  };

  useEffect(() => {
    if (!selectedTodo) {
      setSelectedRowKey(null);
    }
  }, [selectedTodo]);

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
        {projects
          .filter((project) => !project.parentProjectId)
          .map((project) => {
            const isParentSelected = selectedProject?.id === project.id;
            const isSubprojectSelected =
              selectedProject?.parentProjectId === project.id;
            const isCollapsedSubprojectSelected =
              collapsedSelectedSubprojectId !== null &&
              subprojectsBelongsToProject(
                projects,
                collapsedSelectedSubprojectId,
                project.id,
              );
            const isGroupExpanded =
              isParentSelected ||
              isSubprojectSelected ||
              isCollapsedSubprojectSelected;
            const subprojects = isGroupExpanded ? getSubprojects(project.id) : [];
            const childRows = isGroupExpanded ? getProjectRows(project.id) : [];

            return (
              <View key={project.id} style={styles.projectGroup}>
                <ProjectItem
                  project={project}
                  isSelected={isParentSelected}
                  selectProject={() => handleProjectSelect(project)}
                  updateProject={updateProject}
                  stopOtherEdits={() => stopOtherEdits(project.id, "project")}
                  ref={(ref) => {
                    if (ref) {
                      projectRefs.current[project.id] = ref;
                    }
                  }}
                />
                {isGroupExpanded ? (
                  <>
                    {subprojects.map((subproject) => {
                      const isSelected = selectedProject?.id === subproject.id;
                      const isCollapsedSelected =
                        collapsedSelectedSubprojectId === subproject.id;
                      const subprojectRows = isSelected && !isCollapsedSelected
                        ? getProjectRows(subproject.id)
                        : [];

                      return (
                        <View
                          key={subproject.id}
                          style={styles.subprojectGroup}
                        >
                          <ProjectItem
                            project={subproject}
                            isSelected={isSelected || isCollapsedSelected}
                            selectProject={() =>
                              handleProjectSelect(subproject)
                            }
                            updateProject={updateProject}
                            stopOtherEdits={() =>
                              stopOtherEdits(subproject.id, "project")
                            }
                            ref={(ref) => {
                              if (ref) {
                                projectRefs.current[subproject.id] = ref;
                              }
                            }}
                          />
                          {isSelected ? (
                            <ProjectChildRows
                              projectId={subproject.id}
                              rows={subprojectRows}
                              isSelectedRow={isSelectedRow}
                              onSelectRow={handleTodoSelect}
                              updateRowTodo={updateRowTodo}
                              stopOtherEdits={(todoId) =>
                                stopOtherEdits(todoId, "todo")
                              }
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
                    {childRows.length > 0 ? (
                      <ProjectChildRows
                        projectId={project.id}
                        rows={childRows}
                        isSelectedRow={isSelectedRow}
                        onSelectRow={handleTodoSelect}
                        updateRowTodo={updateRowTodo}
                        stopOtherEdits={(todoId) =>
                          stopOtherEdits(todoId, "todo")
                        }
                        setTodoRef={(todoId, ref) => {
                          if (ref) {
                            todoRefs.current[todoId] = ref;
                          }
                        }}
                      />
                    ) : null}
                  </>
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
  setTodoRef: (todoKey: string, ref: TodoItemRef | null) => void;
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
              ref={(ref) => setTodoRef(rowKey, ref)}
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
  return getProjectTodoRowKey(row);
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
  subprojectGroup: {
    marginLeft: 4,
  },
  projectChildList: {
    overflow: "hidden",
  },
  childTodoContainer: {
    marginLeft: 4,
  },
});

export default ProjectList;
