import React, { useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Project } from "../types";
import { softHaptic } from "../utils/haptics";
import { useTheme } from "../utils/theme";

const colors = ["red", "yellow", "green", "blue"];

interface ProjectSettingsProps {
  project: Project;
  updateProject: (updates: Partial<Project>) => void;
  removeProject: () => void;
}

const ProjectSettings: React.FC<ProjectSettingsProps> = ({
  project,
  updateProject,
  removeProject,
}) => {
  const { theme } = useTheme();
  const [deleteState, setDeleteState] = useState<"initial" | "confirm">(
    "initial",
  );
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDeletePress = () => {
    setDeleteState("confirm");

    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
    }

    deleteTimeoutRef.current = setTimeout(() => {
      setDeleteState("initial");
    }, 3000);
  };

  const handleDeleteLongPress = () => {
    if (deleteState !== "confirm") {
      handleDeletePress();
      return;
    }

    softHaptic();
    removeProject();
    setDeleteState("initial");

    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
    }
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
              project.color === color && [
                styles.selectedColor,
                { borderColor: theme.text },
              ],
            ]}
            onPress={() => updateProject({ color })}
          />
        ))}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          onPress={handleDeletePress}
          onLongPress={handleDeleteLongPress}
          delayLongPress={650}
          style={[
            styles.iconButton,
            deleteState === "confirm" && { backgroundColor: theme.danger },
          ]}
        >
          <Ionicons
            name="trash-outline"
            size={24}
            color={deleteState === "confirm" ? "#FFFFFF" : theme.danger}
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
    default:
      return "#4d96ff";
  }
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 4,
    marginTop: 8,
    padding: 12,
  },
  colorPalette: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    marginTop: 4,
  },
  colorButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  selectedColor: {
    borderWidth: 2,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "center",
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 4,
    justifyContent: "center",
    padding: 10,
  },
});

export default ProjectSettings;
