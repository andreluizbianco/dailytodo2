import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  const canPlay = !isPlaying || isPaused;
  const canPause = isPlaying && !isPaused;
  const canStop = isPlaying || isPaused;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          styles.playButton,
          !canPlay && styles.disabledButton,
          disabled && styles.disabledButton,
        ]}
        onPress={onPlay}
        disabled={disabled || !canPlay}
      >
        <Ionicons
          name="play"
          size={24}
          color={disabled || !canPlay ? "#9CA3AF" : "#2563EB"}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          styles.pauseButton,
          !canPause && styles.disabledButton,
          disabled && styles.disabledButton,
        ]}
        onPress={onPause}
        disabled={disabled || !canPause}
      >
        <Ionicons
          name="pause"
          size={24}
          color={disabled || !canPause ? "#9CA3AF" : "#F59E0B"}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          styles.stopButton,
          !canStop && styles.disabledButton,
          disabled && styles.disabledButton,
        ]}
        onPress={onStop}
        disabled={disabled || !canStop}
      >
        <Ionicons
          name="stop"
          size={24}
          color={disabled || !canStop ? "#9CA3AF" : "#EF4444"}
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
  playButton: {
    borderColor: "#2563EB",
  },
  pauseButton: {
    borderColor: "#F59E0B",
  },
  stopButton: {
    borderColor: "#EF4444",
  },
  disabledButton: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
    opacity: 0.5,
  },
});

export default PlayStopControls;