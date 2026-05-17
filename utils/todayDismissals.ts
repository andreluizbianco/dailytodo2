import AsyncStorage from "@react-native-async-storage/async-storage";

const DISMISSED_TODAY_OCCURRENCES_KEY = "dismissedTodayOccurrences";

export const loadDismissedTodayOccurrences = async (dayKey: string) => {
  const allKeys = await loadAllDismissedOccurrences();
  return allKeys.filter((key) => key.startsWith(`${dayKey}:`));
};

export const dismissTodayOccurrence = async (occurrenceKey: string) => {
  const allKeys = await loadAllDismissedOccurrences();
  const dayPrefix = occurrenceKey.split(":")[0];
  const nextKeys = Array.from(
    new Set([
      ...allKeys.filter((key) => key.startsWith(`${dayPrefix}:`)),
      occurrenceKey,
    ]),
  );

  await AsyncStorage.setItem(
    DISMISSED_TODAY_OCCURRENCES_KEY,
    JSON.stringify(nextKeys),
  );

  return nextKeys;
};

const loadAllDismissedOccurrences = async () => {
  try {
    const saved = await AsyncStorage.getItem(DISMISSED_TODAY_OCCURRENCES_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === "string")
      : [];
  } catch {
    return [];
  }
};
