import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules } from "react-native";

const { TimerModule } = NativeModules;

export type TimerAlertSound = "alarm" | "off";
export type TimerAlertVibration = "double" | "off" | "short" | "long";

export interface TimerAlertPreferences {
  sound: TimerAlertSound;
  vibration: TimerAlertVibration;
  volume: number;
}

const SOUND_KEY = "timerAlertSound";
const VIBRATION_KEY = "timerAlertVibration";
const VOLUME_KEY = "timerAlertVolume";

export const DEFAULT_TIMER_ALERT_PREFERENCES: TimerAlertPreferences = {
  sound: "alarm",
  vibration: "double",
  volume: 0.8,
};

export const loadTimerAlertPreferences =
  async (): Promise<TimerAlertPreferences> => {
    const [sound, vibration, volume] = await Promise.all([
      AsyncStorage.getItem(SOUND_KEY),
      AsyncStorage.getItem(VIBRATION_KEY),
      AsyncStorage.getItem(VOLUME_KEY),
    ]);
    const parsedVolume = Number(volume);

    return {
      sound: sound === "off" ? "off" : "alarm",
      vibration:
        vibration === "off" || vibration === "short" || vibration === "long"
          ? vibration
          : "double",
      volume: Number.isFinite(parsedVolume)
        ? Math.max(0, Math.min(1, parsedVolume))
        : DEFAULT_TIMER_ALERT_PREFERENCES.volume,
    };
  };

export const saveTimerAlertPreferences = async (
  preferences: TimerAlertPreferences,
) => {
  await Promise.all([
    AsyncStorage.setItem(SOUND_KEY, preferences.sound),
    AsyncStorage.setItem(VIBRATION_KEY, preferences.vibration),
    AsyncStorage.setItem(VOLUME_KEY, String(preferences.volume)),
  ]);
};

export const applyTimerAlertPreferences = (
  preferences: TimerAlertPreferences,
) => {
  TimerModule?.setAlertPreferences?.(
    preferences.sound === "alarm",
    preferences.vibration,
    preferences.volume,
  );
};

export const previewTimerAlertSound = (volume: number) => {
  TimerModule?.previewAlertSound?.(Math.max(0, Math.min(1, volume)));
};
