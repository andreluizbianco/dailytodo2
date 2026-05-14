import React, { forwardRef, useEffect, useRef } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Project } from "../types";
import { softHaptic } from "../utils/haptics";
import { getNoteBackgroundColor, useTheme } from "../utils/theme";

interface ProjectItemProps {
  project: Project;
  isSelected: boolean;
  selectProject: () => void;
  updateProject: (id: number, updates: Partial<Project>) => void;
  stopOtherEdits: () => void;
}

export interface ProjectItemRef {
  stopEditing: () => void;
}

const ProjectItem = forwardRef<ProjectItemRef, ProjectItemProps>(
  (
    { project, isSelected, selectProject, updateProject, stopOtherEdits },
    ref,
  ) => {
    const { noteTitleFontSize, theme } = useTheme();
    const [isEditing, setIsEditing] = React.useState(project.isEditing);
    const [editedTitle, setEditedTitle] = React.useState(project.title);
    const inputRef = useRef<TextInput>(null);

    React.useImperativeHandle(ref, () => ({
      stopEditing: () => {
        if (isEditing) {
          handleEndEditing();
        }
      },
    }));

    useEffect(() => {
      setEditedTitle(project.title);
      setIsEditing(project.isEditing);
    }, [project.title, project.isEditing]);

    useEffect(() => {
      if (isEditing) {
        inputRef.current?.focus();
      }
    }, [isEditing]);

    const handleStartEditing = () => {
      setIsEditing(true);
      updateProject(project.id, { isEditing: true });
    };

    const handleEndEditing = () => {
      setIsEditing(false);
      updateProject(project.id, {
        title: editedTitle,
        isEditing: false,
      });
    };

    const handleLongPress = () => {
      softHaptic();
      stopOtherEdits();
      selectProject();
      handleStartEditing();
    };

    const selectionColor = getProjectSelectionColor(project.color);

    return (
      <View
        style={[
          styles.container,
          { backgroundColor: getNoteBackgroundColor(project.color, theme) },
          isSelected && { borderBottomColor: selectionColor },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={selectProject}
          onLongPress={handleLongPress}
          delayLongPress={650}
          style={styles.content}
        >
          {isEditing ? (
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                { color: theme.text, fontSize: noteTitleFontSize },
              ]}
              value={editedTitle}
              onChangeText={setEditedTitle}
              onBlur={handleEndEditing}
              placeholderTextColor={theme.subtleText}
              multiline
            />
          ) : (
            <Text
              style={[
                styles.text,
                { color: theme.text, fontSize: noteTitleFontSize },
                !project.title && { color: theme.subtleText },
              ]}
            >
              {project.title || ""}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  },
);

const getProjectSelectionColor = (color: string) => {
  switch (color) {
    case "red":
      return "#ef4444";
    case "yellow":
      return "#f59e0b";
    case "green":
      return "#10b981";
    case "blue":
    default:
      return "#3b82f6";
  }
};

const styles = StyleSheet.create({
  container: {
    minHeight: 44,
    marginHorizontal: 12,
    marginBottom: 5,
    borderRadius: 4,
    borderBottomWidth: 4,
    borderBottomColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    ...Platform.select({
      android: {
        elevation: 1,
      },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
      },
    }),
  },
  content: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
  },
  text: {
    fontSize: 14,
  },
  input: {
    fontSize: 14,
    margin: 0,
    padding: 0,
  },
});

export default ProjectItem;
