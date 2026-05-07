import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";

interface TimeWheelPickerProps {
  initialHours?: string;
  initialMinutes?: string;
  onTimeChange?: (hours: string, minutes: string) => void;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const MAX_MINUTES = 480;

const TimeWheelPicker: React.FC<TimeWheelPickerProps> = ({
  initialHours = "00",
  initialMinutes = "25",
  onTimeChange,
}) => {
  const scrollRef = useRef<ScrollView>(null);

  const minutesData = useMemo(
    () => Array.from({ length: MAX_MINUTES + 1 }, (_, i) => i),
    [],
  );

  const getTotalMinutes = () =>
    parseInt(initialHours || "0", 10) * 60 +
    parseInt(initialMinutes || "0", 10);

  const [selectedMinutes, setSelectedMinutes] = useState(getTotalMinutes());

  useEffect(() => {
    const total = getTotalMinutes();
    setSelectedMinutes(total);

    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: total * ITEM_HEIGHT,
        animated: false,
      });
    }, 0);
  }, [initialHours, initialMinutes]);

  const commitMinutes = (minutes: number) => {
    const safeMinutes = Math.max(0, Math.min(MAX_MINUTES, minutes));
    setSelectedMinutes(safeMinutes);

    const hours = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;

    onTimeChange?.(
      String(hours).padStart(2, "0"),
      String(mins).padStart(2, "0"),
    );
  };

  const snapToNearest = (offsetY: number) => {
    const index = Math.max(
      0,
      Math.min(MAX_MINUTES, Math.round(offsetY / ITEM_HEIGHT)),
    );

    scrollRef.current?.scrollTo({
      y: index * ITEM_HEIGHT,
      animated: false,
    });

    commitMinutes(index);
  };

  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    snapToNearest(event.nativeEvent.contentOffset.y);
  };

  const handleScrollEndDrag = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    snapToNearest(event.nativeEvent.contentOffset.y);
  };

  return (
    <View style={styles.container}>
      <View style={styles.wheelWrapper}>
        <View style={styles.highlight} />

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start"
          decelerationRate={0.85}
          disableIntervalMomentum={true}
          onMomentumScrollEnd={handleMomentumEnd}
          onScrollEndDrag={handleScrollEndDrag}
          contentContainerStyle={styles.scrollContent}
        >
          {minutesData.map((minute) => (
            <View key={minute} style={styles.item}>
              <Text
                style={[
                  styles.itemText,
                  selectedMinutes === minute && styles.selectedText,
                ]}
              >
                {minute}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
  },
  wheelWrapper: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    width: 160,
    overflow: "hidden",
    justifyContent: "center",
  },
  scrollContent: {
    paddingVertical: ITEM_HEIGHT * 2,
  },
  highlight: {
    position: "absolute",
    top: ITEM_HEIGHT * 2,
    height: ITEM_HEIGHT,
    width: "100%",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    zIndex: -1,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  itemText: {
    fontSize: 20,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  selectedText: {
    fontSize: 24,
    color: "#111827",
    fontWeight: "700",
  },
});

export default TimeWheelPicker;
