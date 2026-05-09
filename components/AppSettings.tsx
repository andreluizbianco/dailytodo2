import React, { useCallback, useEffect, useState } from "react";
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

const AppSettings: React.FC = () => {
  const [notificationStatus, setNotificationStatus] =
    useState<PermissionState>("undetermined");
  const [alertPreferences, setAlertPreferences] =
    useState<TimerAlertPreferences>(DEFAULT_TIMER_ALERT_PREFERENCES);
  const [volumeTrackWidth, setVolumeTrackWidth] = useState(1);

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

  const setVolumeFromX = (x: number, previewSound = false) => {
    const nextVolume = Math.max(0, Math.min(1, x / volumeTrackWidth));

    if (previewSound) {
      updateAlertPreferences({ volume: nextVolume }, true);
      return;
    }

    setAlertPreferences((current) => ({ ...current, volume: nextVolume }));
  };

  const volumePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      setVolumeFromX(event.nativeEvent.locationX);
    },
    onPanResponderMove: (event) => {
      setVolumeFromX(event.nativeEvent.locationX);
    },
    onPanResponderRelease: (event) => {
      setVolumeFromX(event.nativeEvent.locationX, true);
    },
  });

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
      <Text style={styles.title}>Settings</Text>

      <View style={styles.row}>
        <View style={styles.labelGroup}>
          <Ionicons
            name={
              notificationStatus === "granted"
                ? "notifications"
                : "notifications-outline"
            }
            size={22}
            color={notificationStatus === "granted" ? "#16A34A" : "#4B5563"}
          />
          <Text style={styles.label}>Notifications</Text>
        </View>
        <Text style={styles.status}>{notificationStatus}</Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={requestNotificationPermission}
      >
        <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
        <Text style={styles.buttonText}>Allow notifications</Text>
      </TouchableOpacity>

      {Platform.OS === "android" && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={openAppSettings}
        >
          <Ionicons name="settings-outline" size={20} color="#111827" />
          <Text style={styles.secondaryButtonText}>Android app settings</Text>
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Timer alert</Text>

        <Text style={styles.optionLabel}>Sound</Text>
        <View style={styles.segmentedControl}>
          {soundOptions.map((option) => {
            const isSelected = alertPreferences.sound === option.value;

            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.segment, isSelected && styles.segmentSelected]}
                onPress={() => updateAlertPreferences({ sound: option.value })}
              >
                <Text
                  style={[
                    styles.segmentText,
                    isSelected && styles.segmentTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.optionLabel}>Vibration</Text>
        <View style={styles.segmentedControl}>
          {vibrationOptions.map((option) => {
            const isSelected = alertPreferences.vibration === option.value;

            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.segment, isSelected && styles.segmentSelected]}
                onPress={() =>
                  updateAlertPreferences({ vibration: option.value })
                }
              >
                <Text
                  style={[
                    styles.segmentText,
                    isSelected && styles.segmentTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.volumeHeader}>
          <Text style={styles.optionLabel}>Volume</Text>
          <Text style={styles.volumeValue}>
            {Math.round(alertPreferences.volume * 100)}%
          </Text>
        </View>
        <View
          style={styles.sliderTrack}
          onLayout={(event) =>
            setVolumeTrackWidth(Math.max(1, event.nativeEvent.layout.width))
          }
          {...volumePanResponder.panHandlers}
        >
          <View
            style={[
              styles.sliderFill,
              { width: `${alertPreferences.volume * 100}%` },
            ]}
          />
          <View
            style={[
              styles.sliderThumb,
              { left: `${alertPreferences.volume * 100}%` },
            ]}
          />
        </View>
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
  sliderTrack: {
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    marginBottom: 4,
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB",
  },
  sliderThumb: {
    position: "absolute",
    width: 24,
    height: 24,
    marginLeft: -12,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#2563EB",
  },
});

export default AppSettings;
