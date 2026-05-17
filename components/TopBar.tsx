import React from "react";
import { View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { withLongPressHaptic } from "../utils/haptics";
import { useTheme } from "../utils/theme";

interface TopBarProps {
  onAddTodo: () => void;
  onAddPress: () => void;
  onSettingsLongPress: () => void;
  onProjectsLongPress: () => void;
  activeView:
    | "notes"
    | "projects"
    | "timer"
    | "settings"
    | "archive"
    | "calendar";
  setActiveView: (
    view: "notes" | "projects" | "timer" | "settings" | "archive" | "calendar",
  ) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  onCalendarPress: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  onAddTodo,
  onAddPress,
  onSettingsLongPress,
  onProjectsLongPress,
  activeView,
  setActiveView,
  showSettings,
  setShowSettings,
  onCalendarPress,
}) => {
  const { theme } = useTheme();
  const handleNotesPress = () => {
    setActiveView("notes");
  };

  const handleArchivePress = () => {
    if (activeView !== "archive") {
      setActiveView("archive");
      setShowSettings(false);
    } else {
      setShowSettings(!showSettings);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.addButtonSection}>
        <TouchableOpacity
          onPress={onAddPress}
          onLongPress={withLongPressHaptic(onAddTodo)}
          delayLongPress={650}
          style={[styles.addButton, { backgroundColor: theme.primary }]}
        >
          <View style={styles.plusIcon}>
            <View style={styles.plusIconHorizontal} />
            <View style={styles.plusIconVertical} />
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.iconsSection}>
        <TouchableOpacity
          onPress={handleNotesPress}
          onLongPress={withLongPressHaptic(onProjectsLongPress)}
          delayLongPress={650}
          style={styles.iconButton}
        >
          <Ionicons
            name="document-text"
            size={28}
            color={
              activeView === "notes" || activeView === "projects"
                ? theme.primary
                : theme.mutedText
            }
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveView("timer")}
          style={styles.iconButton}
        >
          <Ionicons
            name="time"
            size={28}
            color={activeView === "timer" ? theme.primary : theme.mutedText}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={onCalendarPress} style={styles.iconButton}>
          <Ionicons
            name="calendar"
            size={28}
            color={activeView === "calendar" ? theme.primary : theme.mutedText}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleArchivePress}
          onLongPress={withLongPressHaptic(onSettingsLongPress)}
          delayLongPress={650}
          style={styles.iconButton}
        >
          <Ionicons
            name="archive"
            size={28}
            color={activeView === "archive" ? theme.primary : theme.mutedText}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingTop: Platform.OS === "android" ? 16 : 8,
  },
  addButtonSection: {
    width: "40%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
  },
  iconsSection: {
    width: "60%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
  },
  addButton: {
    backgroundColor: "#2563eb",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  plusIcon: {
    width: 20,
    height: 20,
  },
  plusIconHorizontal: {
    position: "absolute",
    backgroundColor: "white",
    width: 20,
    height: 2,
    top: 9,
  },
  plusIconVertical: {
    position: "absolute",
    backgroundColor: "white",
    width: 2,
    height: 20,
    left: 9,
  },
  iconButton: {
    padding: 10,
    marginHorizontal: 5,
  },
});

export default TopBar;
