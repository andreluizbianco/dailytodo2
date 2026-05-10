import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
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
import {
  DEFAULT_NOTE_BODY_FONT_SIZE,
  DEFAULT_NOTE_TITLE_FONT_SIZE,
  NOTE_BODY_FONT_SIZE_MAX,
  NOTE_BODY_FONT_SIZE_MIN,
  NOTE_COLOR_STRENGTH_MIN,
  NOTE_TITLE_FONT_SIZE_MAX,
  NOTE_TITLE_FONT_SIZE_MIN,
  useTheme,
} from "../utils/theme";
import type { ThemePreference } from "../utils/theme";

type PermissionState = "granted" | "denied" | "undetermined";
type SettingsSectionId = "appearance" | "notifications" | "alert";

const SETTINGS_SECTIONS_KEY = "app:settingsExpandedSections";

const defaultExpandedSections: Record<SettingsSectionId, boolean> = {
  appearance: true,
  notifications: false,
  alert: false,
};

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
    noteBodyFontSize,
    noteColorStrength,
    noteTitleFontSize,
    resetThemeTuning,
    setCurrentIntensity,
    setCurrentNoteColorStrength,
    setNoteBodyFontSize,
    setNoteTitleFontSize,
    setThemePreference,
    theme,
    themeMode,
    themePreference,
  } = useTheme();
  const [notificationStatus, setNotificationStatus] =
    useState<PermissionState>("undetermined");
  const [alertPreferences, setAlertPreferences] =
    useState<TimerAlertPreferences>(DEFAULT_TIMER_ALERT_PREFERENCES);
  const [expandedSections, setExpandedSections] = useState(
    defaultExpandedSections,
  );
  const [hasLoadedSections, setHasLoadedSections] = useState(false);

  const allSectionsExpanded = Object.values(expandedSections).every(Boolean);

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

  useEffect(() => {
    const loadExpandedSections = async () => {
      try {
        const storedValue = await AsyncStorage.getItem(SETTINGS_SECTIONS_KEY);
        const parsedValue = storedValue ? JSON.parse(storedValue) : null;

        if (parsedValue && typeof parsedValue === "object") {
          setExpandedSections({
            appearance:
              typeof parsedValue.appearance === "boolean"
                ? parsedValue.appearance
                : defaultExpandedSections.appearance,
            notifications:
              typeof parsedValue.notifications === "boolean"
                ? parsedValue.notifications
                : defaultExpandedSections.notifications,
            alert:
              typeof parsedValue.alert === "boolean"
                ? parsedValue.alert
                : defaultExpandedSections.alert,
          });
        }
      } catch (error) {
        console.warn("Failed to load settings section state", error);
      } finally {
        setHasLoadedSections(true);
      }
    };

    loadExpandedSections();
  }, []);

  useEffect(() => {
    if (!hasLoadedSections) return;

    AsyncStorage.setItem(
      SETTINGS_SECTIONS_KEY,
      JSON.stringify(expandedSections),
    ).catch((error) => {
      console.warn("Failed to save settings section state", error);
    });
  }, [expandedSections, hasLoadedSections]);

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

  const toggleSection = (sectionId: SettingsSectionId) => {
    setExpandedSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  };

  const toggleAllSections = () => {
    const nextValue = !allSectionsExpanded;
    setExpandedSections({
      appearance: nextValue,
      notifications: nextValue,
      alert: nextValue,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        <TouchableOpacity
          accessibilityLabel={
            allSectionsExpanded
              ? "Collapse all settings sections"
              : "Expand all settings sections"
          }
          onPress={toggleAllSections}
          style={styles.titleToggle}
        >
          <Ionicons
            name={allSectionsExpanded ? "contract-outline" : "expand-outline"}
            size={21}
            color={theme.mutedText}
          />
        </TouchableOpacity>
      </View>

      <SettingsSection
        iconName={isDarkMode ? "moon" : "sunny-outline"}
        isExpanded={expandedSections.appearance}
        onToggle={() => toggleSection("appearance")}
        title="Appearance"
      >
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

        <View style={styles.fontControls}>
          <FontSizeControl
            label="Notes"
            max={NOTE_TITLE_FONT_SIZE_MAX}
            min={NOTE_TITLE_FONT_SIZE_MIN}
            onChange={setNoteTitleFontSize}
            sampleText="Note title"
            value={noteTitleFontSize}
          />
          <FontSizeControl
            label="Text"
            max={NOTE_BODY_FONT_SIZE_MAX}
            min={NOTE_BODY_FONT_SIZE_MIN}
            onChange={setNoteBodyFontSize}
            sampleText="Text sample"
            value={noteBodyFontSize}
          />
          <TouchableOpacity
            style={[styles.resetButton, { borderColor: theme.border }]}
            onPress={() => {
              setNoteTitleFontSize(DEFAULT_NOTE_TITLE_FONT_SIZE);
              setNoteBodyFontSize(DEFAULT_NOTE_BODY_FONT_SIZE);
            }}
          >
            <Text style={[styles.resetButtonText, { color: theme.text }]}>
              Reset text size
            </Text>
          </TouchableOpacity>
        </View>
      </SettingsSection>

      <SettingsSection
        iconName="alarm-outline"
        isExpanded={expandedSections.alert}
        onToggle={() => toggleSection("alert")}
        title="Timer alert"
      >
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
      </SettingsSection>

      <SettingsSection
        iconName={
          notificationStatus === "granted"
            ? "notifications"
            : "notifications-outline"
        }
        iconColor={
          notificationStatus === "granted" ? theme.success : theme.mutedText
        }
        isExpanded={expandedSections.notifications}
        onToggle={() => toggleSection("notifications")}
        rightText={notificationStatus}
        title="Notifications"
      >
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
      </SettingsSection>
    </View>
  );
};

interface SettingsSectionProps {
  children: React.ReactNode;
  iconColor?: string;
  iconName: React.ComponentProps<typeof Ionicons>["name"];
  isExpanded: boolean;
  onToggle: () => void;
  rightText?: string;
  title: string;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  children,
  iconColor,
  iconName,
  isExpanded,
  onToggle,
  rightText,
  title,
}) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.sectionBlock, { borderBottomColor: theme.border }]}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onToggle}
        style={styles.sectionHeader}
      >
        <View style={styles.sectionHeaderLeft}>
          <Ionicons
            name={isExpanded ? "chevron-down" : "chevron-forward"}
            size={18}
            color={theme.mutedText}
          />
          <Ionicons
            name={iconName}
            size={21}
            color={iconColor ?? theme.mutedText}
          />
          <Text style={[styles.label, { color: theme.text }]}>{title}</Text>
        </View>
        {rightText ? (
          <Text style={[styles.status, { color: theme.mutedText }]}>
            {rightText}
          </Text>
        ) : null}
      </TouchableOpacity>

      {isExpanded ? (
        <View style={styles.sectionContent}>{children}</View>
      ) : null}
    </View>
  );
};

interface FontSizeControlProps {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  sampleText: string;
  value: number;
}

const FontSizeControl: React.FC<FontSizeControlProps> = ({
  label,
  max,
  min,
  onChange,
  sampleText,
  value,
}) => {
  const { theme } = useTheme();
  const canDecrease = value > min;
  const canIncrease = value < max;

  return (
    <View style={styles.fontControlRow}>
      <Text
        style={[
          styles.optionLabel,
          styles.fontLabel,
          { color: theme.mutedText },
        ]}
      >
        {label}
      </Text>
      <TouchableOpacity
        disabled={!canDecrease}
        onPress={() => onChange(value - 1)}
        style={[
          styles.stepperButton,
          { borderColor: theme.border },
          !canDecrease && styles.disabledControl,
        ]}
      >
        <Ionicons name="remove" size={18} color={theme.text} />
      </TouchableOpacity>
      <View style={[styles.fontSample, { backgroundColor: theme.control }]}>
        <Text
          numberOfLines={1}
          style={[
            styles.fontSampleText,
            {
              color: theme.text,
              fontSize: value,
              lineHeight: Math.round(value * 1.35),
            },
          ]}
        >
          {sampleText}
        </Text>
        <Text style={[styles.fontSizeValue, { color: theme.subtleText }]}>
          {value}
        </Text>
      </View>
      <TouchableOpacity
        disabled={!canIncrease}
        onPress={() => onChange(value + 1)}
        style={[
          styles.stepperButton,
          { borderColor: theme.border },
          !canIncrease && styles.disabledControl,
        ]}
      >
        <Ionicons name="add" size={18} color={theme.text} />
      </TouchableOpacity>
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
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "700",
  },
  titleToggle: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  sectionBlock: {
    borderBottomColor: "#E5E7EB",
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 42,
  },
  sectionHeaderLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
  },
  sectionContent: {
    gap: 14,
    paddingBottom: 12,
    paddingTop: 6,
  },
  themeControl: {
    borderRadius: 6,
    flexDirection: "row",
    padding: 3,
  },
  themeOption: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 34,
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  themeTuning: {
    gap: 12,
  },
  fontControls: {
    gap: 10,
  },
  fontControlRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  fontLabel: {
    marginBottom: 0,
    marginTop: 0,
    width: 48,
  },
  stepperButton: {
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  disabledControl: {
    opacity: 0.35,
  },
  fontSample: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    minHeight: 46,
    paddingHorizontal: 14,
  },
  fontSampleText: {
    flexShrink: 1,
    fontWeight: "500",
  },
  fontSizeValue: {
    fontSize: 11,
    fontWeight: "700",
  },
  themeSliderGroup: {
    gap: 6,
  },
  themeSliderHeader: {
    alignItems: "center",
    flexDirection: "row",
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
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  label: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
  status: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  button: {
    alignItems: "center",
    backgroundColor: "#2563EB",
    borderRadius: 6,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 46,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#D1D5DB",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 46,
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  optionLabel: {
    color: "#4B5563",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 4,
  },
  segmentedControl: {
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
    flexDirection: "row",
    marginBottom: 4,
    padding: 3,
  },
  segment: {
    alignItems: "center",
    borderRadius: 4,
    flex: 1,
    justifyContent: "center",
    minHeight: 34,
  },
  segmentSelected: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderWidth: 1,
  },
  segmentText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "700",
  },
  volumeValue: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  sliderTouchArea: {
    height: 30,
    justifyContent: "center",
    marginBottom: 4,
  },
  sliderRail: {
    borderRadius: 2,
    height: 3,
  },
  sliderFill: {
    backgroundColor: "#2563EB",
    borderRadius: 2,
    height: 3,
    left: 0,
    position: "absolute",
  },
  sliderThumb: {
    backgroundColor: "#FFFFFF",
    borderColor: "#2563EB",
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    marginLeft: -9,
    position: "absolute",
    width: 18,
  },
});

export default AppSettings;
