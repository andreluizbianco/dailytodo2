import AsyncStorage from "@react-native-async-storage/async-storage";

const AMBIENT_SOUND_ENABLED_KEY = "timerAmbientSoundEnabled";
const AMBIENT_SOUND_ID_KEY = "timerAmbientSoundId";

export type AmbientSoundId = "rain" | "waterfall" | "gentle-rain";

export const ambientSoundOptions: Array<{
  id: AmbientSoundId;
  label: string;
}> = [
  {
    id: "rain",
    label: "Rain",
  },
  {
    id: "waterfall",
    label: "Water",
  },
  {
    id: "gentle-rain",
    label: "Gentle",
  },
];

export const parseAmbientSoundEnabled = (value: string | null): boolean =>
  value === "true";

export const parseAmbientSoundId = (
  value: string | null,
): AmbientSoundId => {
  return ambientSoundOptions.some((option) => option.id === value)
    ? (value as AmbientSoundId)
    : "rain";
};

export const loadAmbientSoundEnabled = async (): Promise<boolean> => {
  const storedValue = await AsyncStorage.getItem(AMBIENT_SOUND_ENABLED_KEY);
  return parseAmbientSoundEnabled(storedValue);
};

export const saveAmbientSoundEnabled = async (
  enabled: boolean,
): Promise<void> => {
  await AsyncStorage.setItem(AMBIENT_SOUND_ENABLED_KEY, String(enabled));
};

export const loadAmbientSoundId = async (): Promise<AmbientSoundId> => {
  const storedValue = await AsyncStorage.getItem(AMBIENT_SOUND_ID_KEY);
  return parseAmbientSoundId(storedValue);
};

export const saveAmbientSoundId = async (
  soundId: AmbientSoundId,
): Promise<void> => {
  await AsyncStorage.setItem(AMBIENT_SOUND_ID_KEY, soundId);
};
