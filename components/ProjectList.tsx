import React, { useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import ProjectItem, { ProjectItemRef } from "./ProjectItem";
import TodoItem, { TodoItemRef } from "./TodoItem";
import { CalendarEntry, Project, Todo } from "../types";

type ProjectTodoSource =
  | { type: "todo" }
  | { type: "archive" }
  | { type: "calendar"; entryId: number };

type ProjectTodoRow = {
  todo: Todo;
  source: ProjectTodoSource;
};

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
              {childRows.map((row) => (
                <View
                  key={`${row.source.type}-${row.source.type === "calendar" ? row.source.entryId : row.todo.id}`}
                  style={styles.childTodoContainer}
                >
                  <TodoItem
                    todo={row.todo}
                    selectTodo={() => handleTodoSelect(row)}
                    isSelected={isSelectedRow(row)}
                    updateTodo={(id, updates) => updateRowTodo(row, updates)}
                    stopOtherEdits={() => stopOtherEdits(row.todo.id, "todo")}
                    onDragStart={() => {}}
                    isDragging={false}
                    onLayout={() => {}}
                    horizontalMargin={12}
                    ref={(ref) => {
                      if (ref) {
                        todoRefs.current[row.todo.id] = ref;
                      }
                    }}
                  />
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
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
  childTodoContainer: {
    marginLeft: 4,
  },
});

export default ProjectList;
