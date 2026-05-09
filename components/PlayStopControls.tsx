import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../utils/theme";

interface PlayStopControlsProps {
  onPlay: () => void | Promise<void>;
  onPause: () => void;
  onStop: () => void;
  isPlaying?: boolean;
  isPaused?: boolean;
  disabled?: boolean;
}

const PlayStopControls: React.FC<PlayStopControlsProps> = ({
  onPlay,
  onPause,
  onStop,
  isPlaying = false,
  isPaused = false,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const canStop = isPlaying || isPaused;
  const isRunning = isPlaying && !isPaused;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: theme.control,
            borderColor: isRunning ? theme.warning : theme.primary,
          },
          disabled && {
            backgroundColor: theme.control,
            borderColor: theme.border,
            opacity: 0.5,
          },
        ]}
        onPress={isRunning ? onPause : onPlay}
        disabled={disabled}
      >
        <Ionicons
          name={isRunning ? "pause" : "play"}
          size={24}
          color={
            disabled
              ? theme.subtleText
              : isRunning
                ? theme.warning
                : theme.primary
          }
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: theme.control, borderColor: theme.danger },
          (!canStop || disabled) && {
            backgroundColor: theme.control,
            borderColor: theme.border,
            opacity: 0.5,
          },
        ]}
        onPress={onStop}
        disabled={disabled || !canStop}
      >
        <Ionicons
          name="stop"
          size={24}
          color={disabled || !canStop ? theme.subtleText : theme.danger}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 28,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
});

export default PlayStopControls;
