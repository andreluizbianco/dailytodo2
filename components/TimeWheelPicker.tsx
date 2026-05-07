import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import WheelPicker from "react-native-wheel-scrollview-picker";

interface TimeWheelPickerProps {
  initialHours?: string;
  initialMinutes?: string;
  onTimeChange?: (hours: string, minutes: string) => void;
  isPlaying?: boolean;
  displayTime?: string;
}

const MAX_MINUTES = 480;

const TimeWheelPicker: React.FC<TimeWheelPickerProps> = ({
  initialHours = "00",
  initialMinutes = "25",
  onTimeChange,
  isPlaying = false,
  displayTime = "00:00",
}) => {
  const minutesData = useMemo(
    () => Array.from({ length: MAX_MINUTES + 1 }, (_, i) => String(i)),
    [],
  );

  const getTotalMinutes = () => {
    const hours = parseInt(initialHours || "0", 10);
    const minutes = parseInt(initialMinutes || "0", 10);
    return Math.max(0, Math.min(MAX_MINUTES, hours * 60 + minutes));
  };

  const [selectedMinuteIndex, setSelectedMinuteIndex] =
    useState(getTotalMinutes());

  useEffect(() => {
    const total = getTotalMinutes();

    if (total !== selectedMinuteIndex) {
      setSelectedMinuteIndex(total);
    }
  }, [initialHours, initialMinutes]);

  const handleMinuteChange = (_value: string | undefined, index: number) => {
    const safeIndex = Math.max(0, Math.min(MAX_MINUTES, index));

    setSelectedMinuteIndex(safeIndex);

    const hours = Math.floor(safeIndex / 60);
    const minutes = safeIndex % 60;

    onTimeChange?.(
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
    );
  };

  if (isPlaying) {
    return (
      <View style={styles.runningContainer}>
        <Text style={styles.runningTime}>{displayTime}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.wheelContainer}>
        <View style={styles.centerHighlight} />
        <View style={styles.topFade} />
        <View style={styles.bottomFade} />

        <WheelPicker
          dataSource={minutesData}
          selectedIndex={selectedMinuteIndex}
          onValueChange={handleMinuteChange}
          wrapperHeight={180}
          wrapperBackground="transparent"
          itemHeight={42}
          highlightColor="transparent"
          highlightBorderWidth={0}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  wheelContainer: {
    width: 150,
    height: 180,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  centerHighlight: {
    position: "absolute",
    top: 69,
    width: 128,
    height: 42,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    zIndex: -1,
  },

  topFade: {
    position: "absolute",
    top: 0,
    height: 64,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.62)",
    zIndex: -1,
  },

  bottomFade: {
    position: "absolute",
    bottom: 0,
    height: 64,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.62)",
    zIndex: -1,
  },

  runningTime: {
    fontSize: 42,
    fontWeight: "700",
    color: "#111827",
    fontVariant: ["tabular-nums"],
  },
  runningContainer: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
});

export default TimeWheelPicker;
