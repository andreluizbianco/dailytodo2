import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import {
  applyTimerAlertPreferences,
  DEFAULT_TIMER_ALERT_PREFERENCES,
  loadTimerAlertPreferences,
  previewTimerAlertSound,
  saveTimerAlertPreferences,
  TimerAlertPreferences,
  TimerAlertSound,
  TimerAlertVibration,
} from "../utils/timerAlertPreferences";
import { NOTE_COLOR_STRENGTH_MIN, useTheme } from "../utils/theme";
import type { ThemePreference } from "../utils/theme";

type PermissionState = "granted" | "denied" | "undetermined";

const soundOptions: Array<{ label: string; value: TimerAlertSound }> = [
  { label: "Alarm", value: "alarm" },
  { label: "Off", value: "off" },
];

const vibrationOptions: Array<{
  label: string;
  value: TimerAlertVibration;
}> = [
  { label: "Double", value: "double" },
  { label: "Short", value: "short" },
  { label: "Long", value: "long" },
  { label: "Off", value: "off" },
];

const themeOptions: Array<{ label: string; value: ThemePreference }> = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

const AppSettings: React.FC = () => {
  const {
    darkIntensity,
    isDarkMode,
    lightIntensity,
    lightNoteColorStrength,
    noteColorStrength,
    resetThemeTuning,
    setCurrentIntensity,
    setCurrentNoteColorStrength,
    setThemePreference,
    theme,
    themeMode,
    themePreference,
  } = useTheme();
  const [notificationStatus, setNotificationStatus] =
    useState<PermissionState>("undetermined");
  const [alertPreferences, setAlertPreferences] =
    useState<TimerAlertPreferences>(DEFAULT_TIMER_ALERT_PREFERENCES);

  const refreshNotificationStatus = useCallback(async () => {
    const permissions = await Notifications.getPermissionsAsync();
    setNotificationStatus(permissions.status as PermissionState);
  }, []);

  useEffect(() => {
    refreshNotificationStatus();
  }, [refreshNotificationStatus]);

  useEffect(() => {
    const loadPreferences = async () => {
      const preferences = await loadTimerAlertPreferences();
      setAlertPreferences(preferences);
      applyTimerAlertPreferences(preferences);
    };

    loadPreferences();
  }, []);

  const updateAlertPreferences = async (
    updates: Partial<TimerAlertPreferences>,
    previewSound = false,
  ) => {
    const nextPreferences = { ...alertPreferences, ...updates };

    setAlertPreferences(nextPreferences);
    applyTimerAlertPreferences(nextPreferences);
    await saveTimerAlertPreferences(nextPreferences);

    if (previewSound && nextPreferences.sound === "alarm") {
      previewTimerAlertSound(nextPreferences.volume);
    }
  };

  const requestNotificationPermission = async () => {
    const permissions = await Notifications.requestPermissionsAsync();
    setNotificationStatus(permissions.status as PermissionState);
  };

  const openAppSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert("Settings unavailable", "Could not open app settings.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

      <View style={[styles.themeSection, { borderBottomColor: theme.border }]}>
        <View style={styles.labelGroup}>
          <Ionicons
            name={isDarkMode ? "moon" : "sunny-outline"}
            size={22}
            color={theme.mutedText}
          />
          <Text style={[styles.label, { color: theme.text }]}>Theme</Text>
        </View>
        <View style={[styles.themeControl, { backgroundColor: theme.control }]}>
          {themeOptions.map((option) => {
            const isSelected = themePreference === option.value;

            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.themeOption,
                  isSelected && {
                    backgroundColor: theme.selected,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setThemePreference(option.value)}
              >
                <Text
                  style={[
                    styles.themeOptionText,
                    { color: isSelected ? theme.text : theme.mutedText },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.themeTuning}>
          <ThemeSlider
            label={`${themeMode === "dark" ? "Dark" : "Light"} intensity`}
            value={isDarkMode ? darkIntensity : lightIntensity}
            onValueChange={setCurrentIntensity}
            min={0}
            max={1}
            minLabel="Softer"
            maxLabel="Deeper"
          />
          <ThemeSlider
            label="Note color strength"
            value={isDarkMode ? noteColorStrength : lightNoteColorStrength}
            onValueChange={setCurrentNoteColorStrength}
            min={NOTE_COLOR_STRENGTH_MIN}
            max={1}
            minLabel="Muted"
            maxLabel="Vivid"
          />
          <TouchableOpacity
            style={[styles.resetButton, { borderColor: theme.border }]}
            onPress={resetThemeTuning}
          >
            <Text style={[styles.resetButtonText, { color: theme.text }]}>
              Reset {themeMode} theme
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.row, { borderBottomColor: theme.border }]}>
        <View style={styles.labelGroup}>
          <Ionicons
            name={
              notificationStatus === "granted"
                ? "notifications"
                : "notifications-outline"
            }
            size={22}
            color={
              notificationStatus === "granted" ? theme.success : theme.mutedText
            }
          />
          <Text style={[styles.label, { color: theme.text }]}>
            Notifications
          </Text>
        </View>
        <Text style={[styles.status, { color: theme.mutedText }]}>
          {notificationStatus}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={requestNotificationPermission}
      >
        <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
        <Text style={styles.buttonText}>Allow notifications</Text>
      </TouchableOpacity>

      {Platform.OS === "android" && (
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={openAppSettings}
        >
          <Ionicons name="settings-outline" size={20} color={theme.text} />
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
            Android app settings
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Timer alert
        </Text>

        <Text style={[styles.optionLabel, { color: theme.mutedText }]}>
          Sound
        </Text>
        <View
          style={[styles.segmentedControl, { backgroundColor: theme.control }]}
        >
          {soundOptions.map((option) => {
            const isSelected = alertPreferences.sound === option.value;

            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.segment,
                  isSelected && [
                    styles.segmentSelected,
                    {
                      backgroundColor: theme.selected,
                      borderColor: theme.border,
                    },
                  ],
                ]}
                onPress={() => updateAlertPreferences({ sound: option.value })}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: theme.mutedText },
                    isSelected && { color: theme.text },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.optionLabel, { color: theme.mutedText }]}>
          Vibration
        </Text>
        <View
          style={[styles.segmentedControl, { backgroundColor: theme.control }]}
        >
          {vibrationOptions.map((option) => {
            const isSelected = alertPreferences.vibration === option.value;

            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.segment,
                  isSelected && [
                    styles.segmentSelected,
                    {
                      backgroundColor: theme.selected,
                      borderColor: theme.border,
                    },
                  ],
                ]}
                onPress={() =>
                  updateAlertPreferences({ vibration: option.value })
                }
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: theme.mutedText },
                    isSelected && { color: theme.text },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ThemeSlider
          label="Volume"
          value={alertPreferences.volume}
          onValueChange={(volume) =>
            setAlertPreferences((current) => ({ ...current, volume }))
          }
          onSlidingComplete={(volume) =>
            updateAlertPreferences({ volume }, true)
          }
          min={0}
          max={1}
          minLabel="Quiet"
          maxLabel="Loud"
        />
      </View>
    </View>
  );
};

interface ThemeSliderProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
}

const ThemeSlider: React.FC<ThemeSliderProps> = ({
  label,
  value,
  onValueChange,
  onSlidingComplete,
  min,
  max,
  minLabel,
  maxLabel,
}) => {
  const { theme } = useTheme();
  const trackRef = useRef<View>(null);
  const [trackWidth, setTrackWidth] = useState(1);
  const [trackPageX, setTrackPageX] = useState(0);

  const valueRatio = Math.max(0, Math.min(1, (value - min) / (max - min)));

  const measureTrack = () => {
    trackRef.current?.measure((_x, _y, width, _height, pageX) => {
      setTrackWidth(Math.max(1, width));
      setTrackPageX(pageX);
    });
  };

  const getValueFromPageX = (pageX: number) => {
    const ratio = Math.max(0, Math.min(1, (pageX - trackPageX) / trackWidth));
    return min + ratio * (max - min);
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      measureTrack();
      onValueChange(getValueFromPageX(event.nativeEvent.pageX));
    },
    onPanResponderMove: (event) => {
      onValueChange(getValueFromPageX(event.nativeEvent.pageX));
    },
    onPanResponderRelease: (event) => {
      onSlidingComplete?.(getValueFromPageX(event.nativeEvent.pageX));
    },
  });

  return (
    <View style={styles.themeSliderGroup}>
      <View style={styles.themeSliderHeader}>
        <Text style={[styles.optionLabel, { color: theme.mutedText }]}>
          {label}
        </Text>
        <Text style={[styles.volumeValue, { color: theme.text }]}>
          {Math.round(value * 100)}%
        </Text>
      </View>
      <View
        ref={trackRef}
        style={styles.sliderTouchArea}
        onLayout={measureTrack}
        {...panResponder.panHandlers}
      >
        <View style={[styles.sliderRail, { backgroundColor: theme.border }]} />
        <View
          style={[
            styles.sliderFill,
            {
              width: `${valueRatio * 100}%`,
              backgroundColor: theme.primary,
            },
          ]}
        />
        <View
          style={[
            styles.sliderThumb,
            {
              left: `${valueRatio * 100}%`,
              backgroundColor: theme.elevated,
              borderColor: theme.primary,
            },
          ]}
        />
      </View>
      <View style={styles.sliderLabelRow}>
        <Text style={[styles.sliderRangeLabel, { color: theme.subtleText }]}>
          {minLabel}
        </Text>
        <Text style={[styles.sliderRangeLabel, { color: theme.subtleText }]}>
          {maxLabel}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 18,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginBottom: 18,
  },
  themeSection: {
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginBottom: 18,
    gap: 14,
  },
  themeControl: {
    flexDirection: "row",
    borderRadius: 6,
    padding: 3,
  },
  themeOption: {
    flex: 1,
    minHeight: 34,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  themeTuning: {
    gap: 12,
  },
  themeSliderGroup: {
    gap: 6,
  },
  themeSliderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sliderLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -2,
  },
  sliderRangeLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  resetButton: {
    minHeight: 36,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  labelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  status: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "capitalize",
  },
  button: {
    minHeight: 46,
    borderRadius: 6,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4B5563",
    marginBottom: 8,
    marginTop: 4,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
    padding: 3,
    marginBottom: 14,
  },
  segment: {
    flex: 1,
    minHeight: 34,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentSelected: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  segmentTextSelected: {
    color: "#111827",
  },
  volumeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  volumeValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  sliderTouchArea: {
    height: 30,
    justifyContent: "center",
    marginBottom: 4,
  },
  sliderRail: {
    height: 3,
    borderRadius: 2,
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#2563EB",
  },
  sliderThumb: {
    position: "absolute",
    width: 18,
    height: 18,
    marginLeft: -9,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#2563EB",
  },
});

export default AppSettings;
