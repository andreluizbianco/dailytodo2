import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { TodoReminder, TodoSchedule } from "../types";
import { softHaptic } from "../utils/haptics";
import {
  REMINDER_AMOUNT_MAX,
  REMINDER_UNITS,
  SCHEDULE_AMOUNT_MAX,
  SCHEDULE_MODES,
  SCHEDULE_UNITS,
  normalizeScheduleTime,
  toggleScheduleWeekday,
  updateReminder,
  updateSchedule,
  WEEKDAYS,
} from "../utils/schedule";
import { useTheme } from "../utils/theme";

const WHEEL_ITEM_HEIGHT = 34;
const WHEEL_VISIBLE_ITEMS = 3;
const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ITEMS;
const WHEEL_SIDE_COUNT = 2;
const WHEEL_DRAG_SENSITIVITY = 0.56;
const WHEEL_VELOCITY_PROJECTION = 78;

interface NoteScheduleSettingsProps {
  schedule?: TodoSchedule;
  reminder?: TodoReminder;
  onChange: (schedule: TodoSchedule | undefined) => void;
  onReminderChange: (reminder: TodoReminder | undefined) => void;
}

const NoteScheduleSettings: React.FC<NoteScheduleSettingsProps> = ({
  schedule,
  reminder,
  onChange,
  onReminderChange,
}) => {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReminderExpanded, setIsReminderExpanded] = useState(false);
  const [editingTimePart, setEditingTimePart] = useState<
    "hours" | "minutes" | null
  >(null);
  const [draftHours, setDraftHours] = useState("");
  const [draftMinutes, setDraftMinutes] = useState("");
  const hoursInputRef = useRef<TextInput>(null);
  const minutesInputRef = useRef<TextInput>(null);
  const movingToMinutesRef = useRef(false);
  const finishingTimeRef = useRef(false);
  const weekdayOpacity = useRef(new Animated.Value(0)).current;
  const isScheduleEnabled = Boolean(schedule);
  const isReminderEnabled = Boolean(reminder);
  const activeSchedule = useMemo(
    () => updateSchedule(schedule, {}),
    [schedule],
  );
  const activeReminder = useMemo(
    () => updateReminder(reminder, {}),
    [reminder],
  );
  const amountValues = useMemo(
    () => Array.from({ length: SCHEDULE_AMOUNT_MAX }, (_, index) => index + 1),
    [],
  );
  const reminderAmountValues = useMemo(
    () => Array.from({ length: REMINDER_AMOUNT_MAX }, (_, index) => index + 1),
    [],
  );

  const handleScheduleChange = (updates: Partial<TodoSchedule>) => {
    softHaptic();
    onChange(updateSchedule(activeSchedule, updates));
  };

  const handleToggleEnabled = () => {
    softHaptic();
    if (isScheduleEnabled) {
      onChange(undefined);
      return;
    }

    setIsExpanded(true);
    onChange(activeSchedule);
  };

  const handleToggleExpanded = () => {
    softHaptic();
    setIsExpanded((current) => !current);
  };

  const handleReminderChange = (updates: Partial<TodoReminder>) => {
    softHaptic();
    onReminderChange(updateReminder(activeReminder, updates));
  };

  const handleToggleReminderEnabled = () => {
    softHaptic();
    if (isReminderEnabled) {
      onReminderChange(undefined);
      return;
    }

    setIsReminderExpanded(true);
    onReminderChange(activeReminder);
  };

  const handleToggleReminderExpanded = () => {
    softHaptic();
    setIsReminderExpanded((current) => !current);
  };

  const shouldShowWeekdays =
    activeSchedule.mode === "every" && activeSchedule.unit === "weeks";

  useEffect(() => {
    Animated.timing(weekdayOpacity, {
      toValue: shouldShowWeekdays ? 1 : 0,
      duration: 140,
      useNativeDriver: true,
    }).start();
  }, [shouldShowWeekdays, weekdayOpacity]);

  const handleWeekdayPress = (weekday: number) => {
    softHaptic();
    onChange(toggleScheduleWeekday(activeSchedule, weekday));
  };

  const normalizedScheduleTime = normalizeScheduleTime(activeSchedule.time);
  const [scheduleHours, scheduleMinutes] = normalizedScheduleTime.split(":");

  const startEditingTime = (part: "hours" | "minutes") => {
    softHaptic();
    setDraftHours(scheduleHours);
    setDraftMinutes(scheduleMinutes);
    setEditingTimePart(part);
  };

  useEffect(() => {
    if (editingTimePart === "hours") {
      selectTimeInput(hoursInputRef);
      return;
    }

    if (editingTimePart === "minutes") {
      selectTimeInput(minutesInputRef);
    }
  }, [editingTimePart]);

  const selectTimeInput = (inputRef: React.RefObject<TextInput>) => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setNativeProps({
        selection: { start: 0, end: 2 },
      });
    }, 20);
    setTimeout(() => {
      inputRef.current?.setNativeProps({
        selection: { start: 0, end: 2 },
      });
    }, 90);
  };

  const sanitizeTimeInput = (text: string) => {
    return text.replace(/\D/g, "").slice(0, 2);
  };

  const normalizeTimePart = (
    rawValue: string,
    maxValue: number,
    fallbackValue: string,
  ) => {
    const digits = rawValue.replace(/\D/g, "");

    if (digits.length === 0) {
      return fallbackValue;
    }

    const numericValue = Number(digits);
    if (!Number.isFinite(numericValue) || numericValue > maxValue) {
      return null;
    }

    return String(Math.max(0, Math.min(maxValue, numericValue))).padStart(
      2,
      "0",
    );
  };

  const resetTimeEditing = () => {
    setDraftHours(scheduleHours);
    setDraftMinutes(scheduleMinutes);
    setEditingTimePart(null);
  };

  const saveDraftTime = (nextHours: string, nextMinutes: string) => {
    const normalizedHours = normalizeTimePart(nextHours, 23, scheduleHours);
    const normalizedMinutes = normalizeTimePart(
      nextMinutes,
      59,
      scheduleMinutes,
    );

    if (normalizedHours === null || normalizedMinutes === null) {
      resetTimeEditing();
      return false;
    }

    setDraftHours(normalizedHours);
    setDraftMinutes(normalizedMinutes);

    const nextTime = normalizeScheduleTime(
      `${normalizedHours}:${normalizedMinutes}`,
    );

    if (nextTime !== normalizedScheduleTime) {
      handleScheduleChange({ time: nextTime });
    }

    return true;
  };

  const commitHoursAndMoveToMinutes = (rawValue: string) => {
    movingToMinutesRef.current = true;
    const nextHours = normalizeTimePart(rawValue, 23, scheduleHours);

    if (nextHours === null) {
      movingToMinutesRef.current = false;
      resetTimeEditing();
      return;
    }

    setDraftHours(nextHours);
    setEditingTimePart("minutes");
    setTimeout(() => {
      movingToMinutesRef.current = false;
    }, 120);
  };

  const finishHoursEditing = () => {
    saveDraftTime(draftHours, draftMinutes);
    setEditingTimePart(null);
  };

  const finishMinutesEditing = () => {
    if (finishingTimeRef.current) {
      finishingTimeRef.current = false;
      return;
    }

    saveDraftTime(draftHours, draftMinutes);
    setEditingTimePart(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.enableRow}>
        <TouchableOpacity
          style={styles.enableLabelGroup}
          onPress={handleToggleExpanded}
          disabled={!isScheduleEnabled}
        >
          <Text
            style={[
              styles.disclosureIcon,
              {
                color: isScheduleEnabled ? theme.mutedText : theme.subtleText,
                transform: [{ rotate: isExpanded ? "90deg" : "0deg" }],
              },
            ]}
          >
            ▸
          </Text>
          <Text style={[styles.enableLabel, { color: theme.text }]}>
            Repeat
          </Text>
        </TouchableOpacity>
        <Switch
          value={isScheduleEnabled}
          onValueChange={handleToggleEnabled}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={theme.elevated}
        />
      </View>

      {!isScheduleEnabled || !isExpanded ? null : (
        <>
          <View style={styles.timeRow}>
            <Text style={[styles.timeLabel, { color: theme.mutedText }]}>
              Time
            </Text>
            <View
              style={[
                styles.timeEditor,
                { backgroundColor: theme.control, borderColor: theme.border },
              ]}
            >
              {editingTimePart === null ? (
                <Text
                  style={[styles.timeText, { color: theme.text }]}
                  onLongPress={() => startEditingTime("hours")}
                  onPress={() => startEditingTime("hours")}
                >
                  {scheduleHours}
                </Text>
              ) : (
                <TextInput
                  ref={hoursInputRef}
                  style={[styles.timeInput, { color: theme.text }]}
                  value={draftHours}
                  onChangeText={(text) => {
                    setEditingTimePart("hours");
                    const numericText = sanitizeTimeInput(text);

                    setDraftHours(numericText);

                    if (numericText.length === 2) {
                      commitHoursAndMoveToMinutes(numericText);
                    }
                  }}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  maxLength={2}
                  onFocus={() => {
                    if (editingTimePart !== "hours") {
                      setEditingTimePart("hours");
                      selectTimeInput(hoursInputRef);
                    }
                  }}
                  onBlur={() => {
                    if (!movingToMinutesRef.current) {
                      finishHoursEditing();
                    }
                  }}
                />
              )}
              <Text style={[styles.timeColon, { color: theme.mutedText }]}>
                :
              </Text>
              {editingTimePart === null ? (
                <Text
                  style={[styles.timeText, { color: theme.text }]}
                  onLongPress={() => startEditingTime("minutes")}
                  onPress={() => startEditingTime("minutes")}
                >
                  {scheduleMinutes}
                </Text>
              ) : (
                <TextInput
                  ref={minutesInputRef}
                  style={[styles.timeInput, { color: theme.text }]}
                  value={draftMinutes}
                  onChangeText={(text) => {
                    setEditingTimePart("minutes");
                    const numericText = sanitizeTimeInput(text);

                    setDraftMinutes(numericText);

                    if (numericText.length === 2) {
                      if (saveDraftTime(draftHours, numericText)) {
                        finishingTimeRef.current = true;
                        setEditingTimePart(null);
                      }
                    }
                  }}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  maxLength={2}
                  onFocus={() => {
                    if (editingTimePart !== "minutes") {
                      setEditingTimePart("minutes");
                      selectTimeInput(minutesInputRef);
                    }
                  }}
                  onBlur={finishMinutesEditing}
                />
              )}
            </View>
          </View>

          <View style={styles.wheelRow}>
            <MiniWheelPicker
              values={SCHEDULE_MODES}
              selectedValue={activeSchedule.mode}
              formatValue={(value) => value}
              onChange={(mode) => handleScheduleChange({ mode })}
              dragSensitivity={0.42}
              velocityProjection={42}
            />
            <MiniWheelPicker
              values={amountValues}
              selectedValue={activeSchedule.amount}
              formatValue={(value) => String(value)}
              onChange={(amount) => handleScheduleChange({ amount })}
              dragSensitivity={0.92}
              velocityProjection={180}
            />
            <MiniWheelPicker
              values={SCHEDULE_UNITS}
              selectedValue={activeSchedule.unit}
              formatValue={(value, isSelected) =>
                isSelected
                  ? activeSchedule.amount === 1
                    ? value.replace(/s$/, "")
                    : value
                  : value
              }
              onChange={(unit) => handleScheduleChange({ unit })}
              dragSensitivity={0.42}
              velocityProjection={42}
            />
          </View>

          <Animated.View
            pointerEvents={shouldShowWeekdays ? "auto" : "none"}
            style={[styles.weekdayRow, { opacity: weekdayOpacity }]}
          >
            {WEEKDAYS.map((weekday) => {
              const isSelected =
                activeSchedule.weekdays?.includes(weekday.value) ?? false;

              return (
                <TouchableOpacity
                  key={weekday.value}
                  style={[
                    styles.weekdayButton,
                    {
                      borderColor: "transparent",
                    },
                  ]}
                  onPress={() => handleWeekdayPress(weekday.value)}
                >
                  <Text
                    style={[
                      styles.weekdayText,
                      {
                        color: isSelected ? theme.primary : theme.subtleText,
                        opacity: isSelected ? 1 : 0.52,
                      },
                    ]}
                  >
                    {weekday.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </>
      )}

      <View style={styles.enableRow}>
        <TouchableOpacity
          style={styles.enableLabelGroup}
          onPress={handleToggleReminderExpanded}
          disabled={!isReminderEnabled}
        >
          <Text
            style={[
              styles.disclosureIcon,
              {
                color: isReminderEnabled ? theme.mutedText : theme.subtleText,
                transform: [{ rotate: isReminderExpanded ? "90deg" : "0deg" }],
              },
            ]}
          >
            {"\u25B8"}
          </Text>
          <Text style={[styles.enableLabel, { color: theme.text }]}>
            Reminder
          </Text>
        </TouchableOpacity>
        <Switch
          value={isReminderEnabled}
          onValueChange={handleToggleReminderEnabled}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={theme.elevated}
        />
      </View>

      {!isReminderEnabled || !isReminderExpanded ? null : (
        <View style={styles.reminderRow}>
          <MiniWheelPicker
            values={reminderAmountValues}
            selectedValue={activeReminder.amount}
            formatValue={(value) => String(value)}
            onChange={(amount) => handleReminderChange({ amount })}
            dragSensitivity={0.92}
            velocityProjection={180}
          />
          <MiniWheelPicker
            values={REMINDER_UNITS}
            selectedValue={activeReminder.unit}
            formatValue={(value, isSelected) =>
              isSelected
                ? activeReminder.amount === 1
                  ? value.replace(/s$/, "")
                  : value
                : value
            }
            onChange={(unit) => handleReminderChange({ unit })}
            dragSensitivity={0.42}
            velocityProjection={42}
          />
          <View style={styles.beforeColumn}>
            <Text style={[styles.beforeText, { color: theme.text }]}>
              before
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

interface MiniWheelPickerProps<T extends string | number> {
  values: T[];
  selectedValue: T;
  formatValue: (value: T, isSelected: boolean) => string;
  onChange: (value: T) => void;
  dragSensitivity?: number;
  velocityProjection?: number;
}

const MiniWheelPicker = <T extends string | number>({
  values,
  selectedValue,
  formatValue,
  onChange,
  dragSensitivity = WHEEL_DRAG_SENSITIVITY,
  velocityProjection = WHEEL_VELOCITY_PROJECTION,
}: MiniWheelPickerProps<T>) => {
  const { theme } = useTheme();
  const selectedIndex = Math.max(0, values.indexOf(selectedValue));
  const animatedOffset = useRef(
    new Animated.Value(selectedIndex * WHEEL_ITEM_HEIGHT),
  ).current;
  const currentOffsetRef = useRef(selectedIndex * WHEEL_ITEM_HEIGHT);
  const onChangeRef = useRef(onChange);
  const selectedValueRef = useRef(selectedValue);
  const startOffsetRef = useRef(selectedIndex * WHEEL_ITEM_HEIGHT);
  const valuesRef = useRef(values);
  const [, forceRender] = React.useReducer((value) => value + 1, 0);

  useEffect(() => {
    onChangeRef.current = onChange;
    selectedValueRef.current = selectedValue;
    valuesRef.current = values;
  });

  useEffect(() => {
    const listenerId = animatedOffset.addListener(({ value }) => {
      currentOffsetRef.current = clampWheelOffset(value, values.length);
      forceRender();
    });

    return () => animatedOffset.removeListener(listenerId);
  }, [animatedOffset, values.length]);

  useEffect(() => {
    const nextOffset = selectedIndex * WHEEL_ITEM_HEIGHT;
    animatedOffset.stopAnimation();
    animatedOffset.setValue(nextOffset);
    currentOffsetRef.current = nextOffset;
  }, [animatedOffset, selectedIndex]);

  const settleToIndex = (
    index: number,
    animated = true,
    projectedVelocity = 0,
  ) => {
    const currentValues = valuesRef.current;
    const safeIndex = Math.max(0, Math.min(currentValues.length - 1, index));
    const nextValue = currentValues[safeIndex];
    const nextOffset = safeIndex * WHEEL_ITEM_HEIGHT;

    if (animated) {
      const distance = Math.abs(nextOffset - currentOffsetRef.current);
      const duration = Math.max(
        120,
        Math.min(680, distance * 7.2 + Math.abs(projectedVelocity) * 28),
      );

      Animated.timing(animatedOffset, {
        toValue: nextOffset,
        duration,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished && nextValue !== selectedValueRef.current) {
          onChangeRef.current(nextValue);
        }
      });
    } else {
      animatedOffset.setValue(nextOffset);
      if (nextValue !== selectedValueRef.current) {
        onChangeRef.current(nextValue);
      }
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        animatedOffset.stopAnimation((value) => {
          startOffsetRef.current = clampWheelOffset(
            value,
            valuesRef.current.length,
          );
          currentOffsetRef.current = startOffsetRef.current;
        });
      },
      onPanResponderMove: (_event, gestureState) => {
        const nextOffset = clampWheelOffset(
          startOffsetRef.current - gestureState.dy * dragSensitivity,
          valuesRef.current.length,
        );
        animatedOffset.setValue(nextOffset);
      },
      onPanResponderRelease: (_event, gestureState) => {
        const projectedOffset = clampWheelOffset(
          currentOffsetRef.current - gestureState.vy * velocityProjection,
          valuesRef.current.length,
        );
        settleToIndex(
          Math.round(projectedOffset / WHEEL_ITEM_HEIGHT),
          true,
          gestureState.vy,
        );
      },
      onPanResponderTerminate: () => {
        settleToIndex(Math.round(currentOffsetRef.current / WHEEL_ITEM_HEIGHT));
      },
    }),
  ).current;

  const currentIndex = currentOffsetRef.current / WHEEL_ITEM_HEIGHT;
  const firstIndex = Math.max(0, Math.floor(currentIndex) - WHEEL_SIDE_COUNT);
  const lastIndex = Math.min(
    values.length - 1,
    Math.ceil(currentIndex) + WHEEL_SIDE_COUNT,
  );

  return (
    <View style={styles.wheelContainer} {...panResponder.panHandlers}>
      <View style={[styles.wheelFocus, { borderColor: theme.border }]} />
      <View style={styles.wheel}>
        {values.slice(firstIndex, lastIndex + 1).map((value, localIndex) => {
          const index = firstIndex + localIndex;
          const distance = index - currentIndex;
          const top = WHEEL_ITEM_HEIGHT + distance * WHEEL_ITEM_HEIGHT;
          const focus = Math.max(0, 1 - Math.abs(distance) / 2.2);

          return (
            <TouchableOpacity
              key={String(value)}
              activeOpacity={0.8}
              style={[styles.wheelItem, { top }]}
              onPress={() => settleToIndex(index)}
            >
              <Text
                style={[
                  styles.wheelText,
                  {
                    color: focus > 0.82 ? theme.text : theme.subtleText,
                    opacity: 0.32 + focus * 0.68,
                    transform: [{ scale: 0.92 + focus * 0.08 }],
                  },
                ]}
              >
                {formatValue(value, focus > 0.82)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const clampWheelOffset = (offset: number, valueCount: number) => {
  return Math.max(0, Math.min((valueCount - 1) * WHEEL_ITEM_HEIGHT, offset));
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginBottom: 12,
  },
  enableRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  enableLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  enableLabelGroup: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
  },
  disclosureIcon: {
    fontSize: 15,
    fontWeight: "800",
    width: 16,
    lineHeight: 16,
    marginRight: 7,
    textAlign: "center",
    includeFontPadding: false,
  },
  wheelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  beforeColumn: {
    flex: 1,
    height: WHEEL_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  beforeText: {
    fontSize: 15,
    fontWeight: "600",
    textTransform: "lowercase",
  },
  timeRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  timeLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  timeEditor: {
    minWidth: 70,
    minHeight: 30,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  timeText: {
    minWidth: 22,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  timeInput: {
    width: 24,
    padding: 0,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  timeColon: {
    fontSize: 15,
    fontWeight: "600",
    marginHorizontal: 1,
  },
  wheelContainer: {
    flex: 1,
    height: WHEEL_HEIGHT,
    overflow: "hidden",
  },
  wheelFocus: {
    position: "absolute",
    top: WHEEL_ITEM_HEIGHT,
    left: 0,
    right: 0,
    height: WHEEL_ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  wheel: {
    height: WHEEL_HEIGHT,
    position: "relative",
  },
  wheelItem: {
    position: "absolute",
    left: 0,
    right: 0,
    height: WHEEL_ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelText: {
    fontSize: 15,
    fontWeight: "600",
    textTransform: "lowercase",
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 2,
  },
  weekdayButton: {
    minWidth: 20,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  weekdayText: {
    fontSize: 13,
    fontWeight: "700",
  },
});

export default NoteScheduleSettings;
