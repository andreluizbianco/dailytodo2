import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";

export type ThemeMode = "light" | "dark";
export type ThemePreference = "system" | "light" | "dark";

const THEME_MODE_KEY = "app:themeMode";
const DARK_INTENSITY_KEY = "app:darkIntensity";
const NOTE_COLOR_STRENGTH_KEY = "app:noteColorStrength";
const LIGHT_INTENSITY_KEY = "app:lightIntensity";
const LIGHT_NOTE_COLOR_STRENGTH_KEY = "app:lightNoteColorStrength";

export const DEFAULT_DARK_INTENSITY = 0.65;
export const DEFAULT_LIGHT_INTENSITY = 0.5;
export const DEFAULT_DARK_NOTE_COLOR_STRENGTH = 0.58;
export const DEFAULT_LIGHT_NOTE_COLOR_STRENGTH = 0.76;
export const NOTE_COLOR_STRENGTH_MIN = 0.4;

export const lightTheme = {
  mode: "light" as ThemeMode,
  background: "#FFFFFF",
  surface: "#F9FAFB",
  elevated: "#FFFFFF",
  text: "#111827",
  mutedText: "#6B7280",
  subtleText: "#9CA3AF",
  border: "#E5E7EB",
  control: "#F3F4F6",
  selected: "#FFFFFF",
  primary: "#2563EB",
  primarySoft: "#DBEAFE",
  danger: "#EF4444",
  warning: "#F59E0B",
  success: "#16A34A",
  note: {
    red: "#FEE2E2",
    yellow: "#FEF3C7",
    green: "#D1FAE5",
    blue: "#DBEAFE",
    default: "#F3F4F6",
  },
};

export const darkTheme = {
  mode: "dark" as ThemeMode,
  background: "#101214",
  surface: "#171A1F",
  elevated: "#20242B",
  text: "#E5E7EB",
  mutedText: "#A3AAB7",
  subtleText: "#737B8C",
  border: "#2E3440",
  control: "#20242B",
  selected: "#2A303A",
  primary: "#60A5FA",
  primarySoft: "#172B45",
  danger: "#F87171",
  warning: "#FBBF24",
  success: "#4ADE80",
  note: {
    red: "#3A2024",
    yellow: "#342B16",
    green: "#173328",
    blue: "#172B45",
    default: "#20242B",
  },
};

export type AppTheme = typeof lightTheme;

interface ThemeContextValue {
  darkIntensity: number;
  isDarkMode: boolean;
  lightIntensity: number;
  lightNoteColorStrength: number;
  noteColorStrength: number;
  resetThemeTuning: () => void;
  setCurrentIntensity: (value: number) => void;
  setCurrentNoteColorStrength: (value: number) => void;
  setDarkIntensity: (value: number) => void;
  setLightIntensity: (value: number) => void;
  setLightNoteColorStrength: (value: number) => void;
  setNoteColorStrength: (value: number) => void;
  setThemePreference: (preference: ThemePreference) => void;
  setDarkMode: (enabled: boolean) => void;
  themeMode: ThemeMode;
  themePreference: ThemePreference;
  theme: AppTheme;
}

const ThemeContext = createContext<ThemeContextValue>({
  darkIntensity: DEFAULT_DARK_INTENSITY,
  isDarkMode: false,
  lightIntensity: DEFAULT_LIGHT_INTENSITY,
  lightNoteColorStrength: DEFAULT_LIGHT_NOTE_COLOR_STRENGTH,
  noteColorStrength: DEFAULT_DARK_NOTE_COLOR_STRENGTH,
  resetThemeTuning: () => undefined,
  setCurrentIntensity: () => undefined,
  setCurrentNoteColorStrength: () => undefined,
  setDarkIntensity: () => undefined,
  setLightIntensity: () => undefined,
  setLightNoteColorStrength: () => undefined,
  setNoteColorStrength: () => undefined,
  setThemePreference: () => undefined,
  setDarkMode: () => undefined,
  themeMode: "light",
  themePreference: "system",
  theme: lightTheme,
});

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const systemColorScheme = useColorScheme();
  const [darkIntensity, setDarkIntensityState] = useState(
    DEFAULT_DARK_INTENSITY,
  );
  const [lightIntensity, setLightIntensityState] = useState(
    DEFAULT_LIGHT_INTENSITY,
  );
  const [noteColorStrength, setNoteColorStrengthState] = useState(
    DEFAULT_DARK_NOTE_COLOR_STRENGTH,
  );
  const [lightNoteColorStrength, setLightNoteColorStrengthState] = useState(
    DEFAULT_LIGHT_NOTE_COLOR_STRENGTH,
  );
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>("system");

  useEffect(() => {
    const loadThemeSettings = async () => {
      try {
        const [
          storedTheme,
          storedDarkIntensity,
          storedNoteColorStrength,
          storedLightIntensity,
          storedLightNoteColorStrength,
        ] = await Promise.all([
          AsyncStorage.getItem(THEME_MODE_KEY),
          AsyncStorage.getItem(DARK_INTENSITY_KEY),
          AsyncStorage.getItem(NOTE_COLOR_STRENGTH_KEY),
          AsyncStorage.getItem(LIGHT_INTENSITY_KEY),
          AsyncStorage.getItem(LIGHT_NOTE_COLOR_STRENGTH_KEY),
        ]);

        if (
          storedTheme === "system" ||
          storedTheme === "light" ||
          storedTheme === "dark"
        ) {
          setThemePreferenceState(storedTheme);
        }

        const nextDarkIntensity = parseStoredSliderValue(
          storedDarkIntensity,
          0,
          1,
        );
        if (nextDarkIntensity !== null) {
          setDarkIntensityState(nextDarkIntensity);
        }

        const nextNoteColorStrength = parseStoredSliderValue(
          storedNoteColorStrength,
          NOTE_COLOR_STRENGTH_MIN,
          1,
        );
        if (nextNoteColorStrength !== null) {
          setNoteColorStrengthState(nextNoteColorStrength);
        }

        const nextLightIntensity = parseStoredSliderValue(
          storedLightIntensity,
          0,
          1,
        );
        if (nextLightIntensity !== null) {
          setLightIntensityState(nextLightIntensity);
        }

        const nextLightNoteColorStrength = parseStoredSliderValue(
          storedLightNoteColorStrength,
          NOTE_COLOR_STRENGTH_MIN,
          1,
        );
        if (nextLightNoteColorStrength !== null) {
          setLightNoteColorStrengthState(nextLightNoteColorStrength);
        }
      } catch (error) {
        console.error("Failed to load theme settings:", error);
      }
    };

    loadThemeSettings();
  }, []);

  const setThemePreference = (preference: ThemePreference) => {
    setThemePreferenceState(preference);
    AsyncStorage.setItem(THEME_MODE_KEY, preference).catch((error) => {
      console.error("Failed to save theme mode:", error);
    });
  };

  const setDarkMode = (enabled: boolean) => {
    setThemePreference(enabled ? "dark" : "light");
  };

  const setDarkIntensity = (value: number) => {
    const nextValue = clamp(value, 0, 1);
    setDarkIntensityState(nextValue);
    AsyncStorage.setItem(DARK_INTENSITY_KEY, String(nextValue)).catch(
      (error) => {
        console.error("Failed to save dark intensity:", error);
      },
    );
  };

  const setLightIntensity = (value: number) => {
    const nextValue = clamp(value, 0, 1);
    setLightIntensityState(nextValue);
    AsyncStorage.setItem(LIGHT_INTENSITY_KEY, String(nextValue)).catch(
      (error) => {
        console.error("Failed to save light intensity:", error);
      },
    );
  };

  const setNoteColorStrength = (value: number) => {
    const nextValue = clamp(value, NOTE_COLOR_STRENGTH_MIN, 1);
    setNoteColorStrengthState(nextValue);
    AsyncStorage.setItem(NOTE_COLOR_STRENGTH_KEY, String(nextValue)).catch(
      (error) => {
        console.error("Failed to save note color strength:", error);
      },
    );
  };

  const setLightNoteColorStrength = (value: number) => {
    const nextValue = clamp(value, NOTE_COLOR_STRENGTH_MIN, 1);
    setLightNoteColorStrengthState(nextValue);
    AsyncStorage.setItem(
      LIGHT_NOTE_COLOR_STRENGTH_KEY,
      String(nextValue),
    ).catch((error) => {
      console.error("Failed to save light note color strength:", error);
    });
  };

  const resetThemeTuning = () => {
    if (resolvedThemeMode === "dark") {
      setDarkIntensity(DEFAULT_DARK_INTENSITY);
      setNoteColorStrength(DEFAULT_DARK_NOTE_COLOR_STRENGTH);
      return;
    }

    setLightIntensity(DEFAULT_LIGHT_INTENSITY);
    setLightNoteColorStrength(DEFAULT_LIGHT_NOTE_COLOR_STRENGTH);
  };

  const resolvedThemeMode: ThemeMode =
    themePreference === "system"
      ? systemColorScheme === "dark"
        ? "dark"
        : "light"
      : themePreference;

  const value = useMemo(
    () => ({
      isDarkMode: resolvedThemeMode === "dark",
      darkIntensity,
      lightIntensity,
      lightNoteColorStrength,
      noteColorStrength,
      resetThemeTuning,
      setCurrentIntensity:
        resolvedThemeMode === "dark" ? setDarkIntensity : setLightIntensity,
      setCurrentNoteColorStrength:
        resolvedThemeMode === "dark"
          ? setNoteColorStrength
          : setLightNoteColorStrength,
      setDarkIntensity,
      setLightIntensity,
      setLightNoteColorStrength,
      setNoteColorStrength,
      setThemePreference,
      setDarkMode,
      themeMode: resolvedThemeMode,
      themePreference,
      theme:
        resolvedThemeMode === "dark"
          ? createTunedDarkTheme(darkIntensity, noteColorStrength)
          : createTunedLightTheme(lightIntensity, lightNoteColorStrength),
    }),
    [
      darkIntensity,
      lightIntensity,
      lightNoteColorStrength,
      noteColorStrength,
      resolvedThemeMode,
      themePreference,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

const parseStoredSliderValue = (
  value: string | null,
  min: number,
  max: number,
): number | null => {
  if (value === null) return null;

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return null;

  return clamp(parsedValue, min, max);
};

const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

const hexToRgb = (hex: string) => {
  const normalizedHex = hex.replace("#", "");
  return {
    r: parseInt(normalizedHex.slice(0, 2), 16),
    g: parseInt(normalizedHex.slice(2, 4), 16),
    b: parseInt(normalizedHex.slice(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const toHex = (value: number) =>
    Math.round(clamp(value, 0, 255))
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mixHex = (from: string, to: string, amount: number) => {
  const fromRgb = hexToRgb(from);
  const toRgb = hexToRgb(to);

  return rgbToHex({
    r: fromRgb.r + (toRgb.r - fromRgb.r) * amount,
    g: fromRgb.g + (toRgb.g - fromRgb.g) * amount,
    b: fromRgb.b + (toRgb.b - fromRgb.b) * amount,
  });
};

const adjustDarkNeutral = (hex: string, intensity: number) => {
  const delta = DEFAULT_DARK_INTENSITY - intensity;

  if (Math.abs(delta) < 0.01) return hex;

  if (delta > 0) {
    return mixHex(hex, "#FFFFFF", delta * 0.28);
  }

  return mixHex(hex, "#000000", Math.abs(delta) * 0.34);
};

const createTunedDarkTheme = (
  darkIntensity: number,
  noteColorStrength: number,
): AppTheme => {
  const background = adjustDarkNeutral(darkTheme.background, darkIntensity);
  const surface = adjustDarkNeutral(darkTheme.surface, darkIntensity);
  const elevated = adjustDarkNeutral(darkTheme.elevated, darkIntensity);
  const control = adjustDarkNeutral(darkTheme.control, darkIntensity);
  const selected = adjustDarkNeutral(darkTheme.selected, darkIntensity);

  return {
    ...darkTheme,
    background,
    surface,
    elevated,
    control,
    selected,
    border: adjustDarkNeutral(darkTheme.border, darkIntensity),
    note: {
      red: mixHex(surface, "#6B2E36", noteColorStrength),
      yellow: mixHex(surface, "#66501C", noteColorStrength),
      green: mixHex(surface, "#24563F", noteColorStrength),
      blue: mixHex(surface, "#22486F", noteColorStrength),
      default: control,
    },
  };
};

const adjustLightNeutral = (hex: string, intensity: number) => {
  const delta = intensity - DEFAULT_LIGHT_INTENSITY;

  if (Math.abs(delta) < 0.01) return hex;

  if (delta > 0) {
    return mixHex(hex, "#000000", delta * 0.12);
  }

  return mixHex(hex, "#FFFFFF", Math.abs(delta) * 0.18);
};

const createTunedLightTheme = (
  lightIntensity: number,
  noteColorStrength: number,
): AppTheme => {
  const background = adjustLightNeutral(lightTheme.background, lightIntensity);
  const surface = adjustLightNeutral(lightTheme.surface, lightIntensity);
  const elevated = adjustLightNeutral(lightTheme.elevated, lightIntensity);
  const control = adjustLightNeutral(lightTheme.control, lightIntensity);
  const selected = adjustLightNeutral(lightTheme.selected, lightIntensity);
  const defaultNote = adjustLightNeutral(
    lightTheme.note.default,
    lightIntensity,
  );

  return {
    ...lightTheme,
    background,
    surface,
    elevated,
    control,
    selected,
    border: adjustLightNeutral(lightTheme.border, lightIntensity),
    note: {
      red: mixHex(defaultNote, lightTheme.note.red, noteColorStrength),
      yellow: mixHex(defaultNote, lightTheme.note.yellow, noteColorStrength),
      green: mixHex(defaultNote, lightTheme.note.green, noteColorStrength),
      blue: mixHex(defaultNote, lightTheme.note.blue, noteColorStrength),
      default: defaultNote,
    },
  };
};

export const getNoteBackgroundColor = (
  color: string,
  theme: AppTheme,
): string => {
  switch (color) {
    case "red":
      return theme.note.red;
    case "yellow":
      return theme.note.yellow;
    case "green":
      return theme.note.green;
    case "blue":
      return theme.note.blue;
    default:
      return theme.note.default;
  }
};
