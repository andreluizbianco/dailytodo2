import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DateFormatPreference, Project, Todo } from "../types";
import NoteTypeSelector from "./NoteTypeSelector";
import NoteScheduleSettings from "./NoteScheduleSettings";
import NoteSettingsSectionHeader from "./NoteSettingsSectionHeader";
import { softHaptic } from "../utils/haptics";
import { useTheme } from "../utils/theme";
import { normalizeNoteForType } from "../utils/checklist";
import { getProjectDisplayLabel } from "../utils/projectLabels";

const colors: string[] = ["red", "yellow", "green", "blue"];

interface TodoSettingsProps {
  todo: Todo;
  projects: Project[];
  updateTodo: (updates: Partial<Todo>) => void;
  removeTodo: () => void;
  archiveTodo: () => void;
  archiveAction?: "archive" | "unarchive" | "none";
  dateFormat?: DateFormatPreference;
  printOnCalendar: (todo: Todo) => void;
}

const TodoSettings: React.FC<TodoSettingsProps> = ({
  todo,
  projects,
  updateTodo,
  removeTodo,
  archiveTodo,
  archiveAction = "archive",
  dateFormat,
  printOnCalendar,
}) => {
  const { theme } = useTheme();
  const [deleteState, setDeleteState] = useState<"initial" | "confirm">(
    "initial",
  );
  const [localNoteType, setLocalNoteType] = useState(todo.noteType);
  const timeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPrintPressed, setIsPrintPressed] = useState(false);
  const [isArchivePressed, setIsArchivePressed] = useState(false);
  const [isDeletePressed, setIsDeletePressed] = useState(false);
  const [isProjectExpanded, setIsProjectExpanded] = useState(false);
  const [expandedParentProjectId, setExpandedParentProjectId] = useState<
    number | null
  >(null);
  const topLevelProjects = projects.filter((project) => !project.parentProjectId);
  const selectedProjectLabel = getProjectDisplayLabel(projects, todo.projectId);

  const getChildProjects = (projectId: number) =>
    projects.filter((project) => project.parentProjectId === projectId);

  useEffect(() => {
    if (!isProjectExpanded || !todo.projectId) return;

    const selectedProject = projects.find(
      (project) => project.id === todo.projectId,
    );
    if (selectedProject?.parentProjectId) {
      setExpandedParentProjectId(selectedProject.parentProjectId);
    } else if (selectedProject && getChildProjects(selectedProject.id).length > 0) {
      setExpandedParentProjectId(selectedProject.id);
    }
  }, [isProjectExpanded, projects, todo.projectId]);

  const handleColorChange = (color: string) => {
    updateTodo({ color });
  };

  const handleDeletePress = () => {
    if (deleteState === "initial") {
      setDeleteState("confirm");
      timeoutRef.current = setTimeout(() => setDeleteState("initial"), 3000);
    }
  };

  const handleDeleteLongPress = () => {
    if (deleteState === "confirm") {
      removeTodo();
      setDeleteState("initial");
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };

  const handleNoteTypeSelect = (type: "text" | "bullet" | "checkbox") => {
    const normalizedNote = normalizeNoteForType(todo.note, type);

    setLocalNoteType(type);
    updateTodo({
      noteType: type,
      note: normalizedNote,
      checkboxBehavior: type === "checkbox" ? "simple" : undefined,
    });
  };

  const handleNoteTypeLongSelect = (type: "text" | "bullet" | "checkbox") => {
    if (type !== "checkbox") return;

    const normalizedNote = normalizeNoteForType(todo.note, type);

    softHaptic();
    setLocalNoteType(type);
    updateTodo({
      noteType: type,
      note: normalizedNote,
      checkboxBehavior: "completion",
    });
  };

  const handleColorSelect = (color: string) => {
    updateTodo({ color });
  };

  const handleLongPress = (action: "print" | "archive" | "delete") => {
    softHaptic();

    switch (action) {
      case "print":
        // Don't update the todo, just print it as is
        printOnCalendar(todo);
        break;
      case "archive":
        archiveTodo();
        break;
      case "delete":
        removeTodo();
        break;
    }
  };

  const handleProjectSelect = (project: Project) => {
    const isRemovingProject = todo.projectId === project.id;
    const childProjects = getChildProjects(project.id);

    if (!project.parentProjectId && childProjects.length > 0) {
      setExpandedParentProjectId((currentId) =>
        isRemovingProject && currentId === project.id ? null : project.id,
      );
    } else if (!project.parentProjectId) {
      setExpandedParentProjectId(null);
    }

    updateTodo({
      projectId: isRemovingProject ? undefined : project.id,
      ...(isRemovingProject
        ? {}
        : { color: project.color }),
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={styles.colorPalette}>
        {colors.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorButton,
              { backgroundColor: getColorValue(color) },
              todo.color === color && [
                styles.selectedColor,
                { borderColor: theme.text },
              ],
            ]}
            onPress={() => handleColorChange(color)}
          />
        ))}
      </View>

      <NoteTypeSelector
        selectedType={localNoteType}
        checkboxBehavior={todo.checkboxBehavior}
        onSelectType={handleNoteTypeSelect}
        onLongSelectType={handleNoteTypeLongSelect}
      />

      <NoteScheduleSettings
        schedule={todo.schedule}
        reminder={todo.reminder}
        dateFormat={dateFormat}
        onChange={(schedule) => updateTodo({ schedule })}
        onReminderChange={(reminder) => updateTodo({ reminder })}
      />

      {projects.length > 0 && (
        <View style={styles.projectSection}>
          <NoteSettingsSectionHeader
            title="Project"
            expanded={isProjectExpanded}
            onPress={() => setIsProjectExpanded((prev) => !prev)}
            detail={!isProjectExpanded ? selectedProjectLabel : undefined}
          />

          {isProjectExpanded && (
            <View style={styles.projectChips}>
              {topLevelProjects.map((project) => {
                const isSelected = todo.projectId === project.id;
                const childProjects = getChildProjects(project.id);
                const isParentExpanded =
                  expandedParentProjectId === project.id ||
                  childProjects.some((child) => child.id === todo.projectId);

                return (
                  <React.Fragment key={project.id}>
                    <TouchableOpacity
                      onPress={() => handleProjectSelect(project)}
                      activeOpacity={0.75}
                      style={[
                        styles.projectChip,
                        {
                          backgroundColor: isSelected
                            ? theme.primary
                            : theme.elevated,
                          borderColor: isSelected ? theme.primary : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.projectChipText,
                          { color: isSelected ? "#FFFFFF" : theme.text },
                        ]}
                      >
                        {project.title || "Untitled"}
                      </Text>
                    </TouchableOpacity>
                    {isParentExpanded &&
                      childProjects.map((childProject) => {
                        const isChildSelected = todo.projectId === childProject.id;

                        return (
                          <TouchableOpacity
                            key={childProject.id}
                            onPress={() => handleProjectSelect(childProject)}
                            activeOpacity={0.75}
                            style={[
                              styles.projectChip,
                              styles.subprojectChip,
                              {
                                backgroundColor: isChildSelected
                                  ? theme.primary
                                  : theme.mode === "light"
                                    ? "#EFF6FF"
                                    : "rgba(96, 165, 250, 0.16)",
                                borderColor: isChildSelected
                                  ? theme.primary
                                  : theme.mode === "light"
                                    ? theme.border
                                    : "rgba(147, 197, 253, 0.42)",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.projectChipText,
                                styles.subprojectChipText,
                                {
                                  color: isChildSelected
                                    ? "#FFFFFF"
                                    : theme.text,
                                },
                              ]}
                            >
                              {childProject.title || "Untitled"}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </View>
      )}

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.iconButton,
            isPrintPressed && styles.iconButtonPressed,
          ]}
          onLongPress={() => {
            setIsPrintPressed(true);
            handleLongPress("print");
            // Reset the pressed state after a short delay
            setTimeout(() => setIsPrintPressed(false), 200);
          }}
          delayLongPress={800}
        >
          <Ionicons
            name="calendar-outline"
            size={24}
            color={isPrintPressed ? theme.elevated : theme.mutedText}
          />
        </TouchableOpacity>

        {archiveAction !== "none" && (
          <TouchableOpacity
            style={[
              styles.iconButton,
              isArchivePressed && styles.iconButtonPressed,
            ]}
            onLongPress={() => {
              setIsArchivePressed(true);
              handleLongPress("archive");
              setTimeout(() => setIsArchivePressed(false), 200);
            }}
            delayLongPress={800}
          >
            <Ionicons
              name={
                archiveAction === "unarchive"
                  ? "arrow-up-circle-outline"
                  : "archive-outline"
              }
              size={24}
              color={isArchivePressed ? theme.elevated : theme.mutedText}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.iconButton,
            isDeletePressed && styles.iconButtonPressed,
          ]}
          onLongPress={() => {
            setIsDeletePressed(true);
            handleLongPress("delete");
            setTimeout(() => setIsDeletePressed(false), 200);
          }}
          delayLongPress={800}
        >
          <Ionicons
            name="trash-outline"
            size={24}
            color={isDeletePressed ? theme.elevated : theme.danger}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getColorValue = (color: string): string => {
  switch (color) {
    case "red":
      return "#ff6b6b";
    case "yellow":
      return "#ffd93d";
    case "green":
      return "#6bcb77";
    case "blue":
      return "#4d96ff";
    default:
      return "#4d96ff";
  }
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  colorPalette: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
    marginTop: 10,
  },
  colorButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  selectedColor: {
    borderWidth: 2,
    borderColor: "#4b5563",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
    marginBottom: 10,
  },
  iconButton: {
    padding: 10,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonPressed: {
    transform: [{ scale: 0.95 }], // optional: adds a slight scale effect
  },
  projectSection: {
    marginTop: 0,
    marginBottom: 12,
  },
  projectChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 4,
  },
  projectChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  projectChipText: {
    fontSize: 14,
  },
  subprojectChip: {
    backgroundColor: "#EFF6FF",
    marginLeft: 6,
  },
  subprojectChipText: {
    fontSize: 13,
  },
});

export default TodoSettings;
