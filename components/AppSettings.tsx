import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  PanResponder,
  Platform,
  StyleSheet,
  Switch,
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
  DEFAULT_NOTE_LIST_WIDTH_RATIO,
  DEFAULT_NOTE_TITLE_FONT_SIZE,
  NOTE_BODY_FONT_SIZE_MAX,
  NOTE_BODY_FONT_SIZE_MIN,
  NOTE_COLOR_STRENGTH_MIN,
  NOTE_LIST_WIDTH_RATIO_MAX,
  NOTE_LIST_WIDTH_RATIO_MIN,
  NOTE_TITLE_FONT_SIZE_MAX,
  NOTE_TITLE_FONT_SIZE_MIN,
  useTheme,
} from "../utils/theme";
import type { ThemePreference } from "../utils/theme";
import { CalendarEntry, Todo, TodoReminder, TodoSchedule, TrashedTodo, TrashRetention } from "../types";
import { WEEKDAYS } from "../utils/schedule";

type PermissionState = "granted" | "denied" | "undetermined";
type SettingsSectionId =
  | "appearance"
  | "calendar"
  | "schedules"
  | "notifications"
  | "alert"
  | "data";

const defaultExpandedSections: Record<SettingsSectionId, boolean> = {
  appearance: false,
  calendar: false,
  schedules: false,
  notifications: false,
  alert: false,
  data: false,
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

const trashRetentionOptions: Array<{
  label: string;
  value: TrashRetention;
}> = [
  { label: "3 days", value: "3d" },
  { label: "7 days", value: "7d" },
  { label: "1 month", value: "30d" },
  { label: "Never", value: "never" },
];

interface AppSettingsProps {
  archivedTodos: Todo[];
  calendarEntries: CalendarEntry[];
  deleteTrashedTodo: (id: number) => void;
  emptyTrash: () => void;
  exportData: () => void;
  importData: () => void;
  onOpenTodo: (id: number | string) => void;
  restoreTrashedTodo: (id: number) => void;
  setCalendarAutoScrollToNow: (enabled: boolean) => void;
  setTrashRetention: (retention: TrashRetention) => void;
  calendarAutoScrollToNow: boolean;
  todos: Todo[];
  trashedTodos: TrashedTodo[];
  trashRetention: TrashRetention;
  updateArchivedTodo: (id: number, updates: Partial<Todo>) => void;
  updateCalendarEntryTodo: (entryId: number, updates: Partial<Todo>) => void;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
}

const AppSettings: React.FC<AppSettingsProps> = ({
  archivedTodos,
  calendarEntries,
  deleteTrashedTodo,
  emptyTrash,
  exportData,
  importData,
  onOpenTodo,
  restoreTrashedTodo,
  setCalendarAutoScrollToNow,
  setTrashRetention,
  calendarAutoScrollToNow,
  todos,
  trashedTodos,
  trashRetention,
  updateArchivedTodo,
  updateCalendarEntryTodo,
  updateTodo,
}) => {
  const {
    darkIntensity,
    isDarkMode,
    lightIntensity,
    lightNoteColorStrength,
    noteBodyFontSize,
    noteColorStrength,
    noteListWidthRatio,
    noteTitleFontSize,
    resetThemeTuning,
    setCurrentIntensity,
    setCurrentNoteColorStrength,
    setNoteBodyFontSize,
    setNoteListWidthRatio,
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
      calendar: nextValue,
      schedules: nextValue,
      notifications: nextValue,
      alert: nextValue,
      data: nextValue,
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

        <View style={styles.layoutControls}>
          <ThemeSlider
            label="List width"
            value={noteListWidthRatio}
            onValueChange={setNoteListWidthRatio}
            min={NOTE_LIST_WIDTH_RATIO_MIN}
            max={NOTE_LIST_WIDTH_RATIO_MAX}
            minLabel="More text"
            maxLabel="More list"
            valueFormatter={(value) => `${Math.round(value * 100)}%`}
          />
          <TouchableOpacity
            style={[styles.resetButton, { borderColor: theme.border }]}
            onPress={() => setNoteListWidthRatio(DEFAULT_NOTE_LIST_WIDTH_RATIO)}
          >
            <Text style={[styles.resetButtonText, { color: theme.text }]}>
              Reset layout
            </Text>
          </TouchableOpacity>
        </View>
      </SettingsSection>

      <SettingsSection
        iconName="calendar-outline"
        isExpanded={expandedSections.calendar}
        onToggle={() => toggleSection("calendar")}
        title="Calendar"
      >
        <View style={styles.scheduleToggleRow}>
          <View style={styles.scheduleLine}>
            <Text style={[styles.scheduleLineLabel, { color: theme.text }]}>
              Auto-scroll to now
            </Text>
            <Text style={[styles.scheduleLineValue, { color: theme.mutedText }]}>
              Center the current time in timeline view and jump to the nearest
              current sticky in day view.
            </Text>
          </View>
          <Switch
            value={calendarAutoScrollToNow}
            onValueChange={setCalendarAutoScrollToNow}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor={theme.elevated}
          />
        </View>
      </SettingsSection>

      <SettingsSection
        iconName="repeat-outline"
        isExpanded={expandedSections.schedules}
        onToggle={() => toggleSection("schedules")}
        title="Schedules"
      >
        <ScheduleOverview
          archivedTodos={archivedTodos}
          calendarEntries={calendarEntries}
          onOpenTodo={onOpenTodo}
          todos={todos}
          updateArchivedTodo={updateArchivedTodo}
          updateCalendarEntryTodo={updateCalendarEntryTodo}
          updateTodo={updateTodo}
        />
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

      <SettingsSection
        iconName="swap-vertical-outline"
        isExpanded={expandedSections.data}
        onToggle={() => toggleSection("data")}
        title="Data"
      >
        <View style={styles.dataActions}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: theme.border }]}
            onPress={exportData}
          >
            <Ionicons name="download-outline" size={20} color={theme.text} />
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
              Export
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: theme.border }]}
            onPress={importData}
          >
            <Ionicons name="cloud-upload-outline" size={20} color={theme.text} />
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
              Import
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.trashHeader}>
          <View style={styles.trashTitleRow}>
            <Ionicons name="trash-outline" size={20} color={theme.mutedText} />
            <Text style={[styles.optionLabel, styles.trashTitle, { color: theme.text }]}>
              Trash
            </Text>
          </View>
          {trashedTodos.length > 0 ? (
            <TouchableOpacity
              onLongPress={emptyTrash}
              delayLongPress={700}
              style={styles.trashIconButton}
            >
              <Ionicons name="trash-bin-outline" size={20} color={theme.danger} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View
          style={[styles.segmentedControl, { backgroundColor: theme.control }]}
        >
          {trashRetentionOptions.map((option) => {
            const isSelected = trashRetention === option.value;

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
                onPress={() => setTrashRetention(option.value)}
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

        {trashedTodos.length === 0 ? (
          <Text style={[styles.emptyTrashText, { color: theme.mutedText }]}>
            Trash is empty
          </Text>
        ) : (
          <View style={styles.trashList}>
            {trashedTodos.map((todo) => (
              <View
                key={`${todo.id}-${todo.deletedAt}`}
                style={[styles.trashItem, { borderColor: theme.border }]}
              >
                <View style={styles.trashItemText}>
                  <Text
                    numberOfLines={1}
                    style={[styles.trashItemTitle, { color: theme.text }]}
                  >
                    {todo.text.trim() || "Untitled Note"}
                  </Text>
                  <Text style={[styles.trashItemDate, { color: theme.subtleText }]}>
                    {new Date(todo.deletedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => restoreTrashedTodo(todo.id)}
                  style={styles.trashIconButton}
                >
                  <Ionicons name="return-up-back-outline" size={21} color={theme.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  onLongPress={() => deleteTrashedTodo(todo.id)}
                  delayLongPress={700}
                  style={styles.trashIconButton}
                >
                  <Ionicons name="close" size={21} color={theme.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
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

type ScheduleOverviewSource = "daily" | "archive" | "calendar";

interface ScheduleOverviewItem {
  key: string;
  todo: Todo;
  source: ScheduleOverviewSource;
  entryId?: number;
}

interface ScheduleOverviewProps {
  archivedTodos: Todo[];
  calendarEntries: CalendarEntry[];
  onOpenTodo: (id: number | string) => void;
  todos: Todo[];
  updateArchivedTodo: (id: number, updates: Partial<Todo>) => void;
  updateCalendarEntryTodo: (
    entryId: number,
    updates: Partial<Todo>,
  ) => void | Promise<void>;
  updateTodo: (id: number, updates: Partial<Todo>) => void | Promise<void>;
}

const ScheduleOverview: React.FC<ScheduleOverviewProps> = ({
  archivedTodos,
  calendarEntries,
  onOpenTodo,
  todos,
  updateArchivedTodo,
  updateCalendarEntryTodo,
  updateTodo,
}) => {
  const { theme } = useTheme();
  const items = getScheduleOverviewItems(todos, archivedTodos, calendarEntries);
  const repeatCount = items.filter((item) => item.todo.schedule).length;
  const reminderCount = items.filter((item) => item.todo.reminder).length;

  const updateItem = (
    item: ScheduleOverviewItem,
    updates: Partial<Todo>,
  ) => {
    if (item.source === "archive") {
      updateArchivedTodo(item.todo.id, updates);
      return;
    }

    if (item.source === "calendar" && item.entryId !== undefined) {
      updateCalendarEntryTodo(item.entryId, updates);
      return;
    }

    updateTodo(item.todo.id, updates);
  };

  if (items.length === 0) {
    return (
      <Text style={[styles.emptySchedulesText, { color: theme.subtleText }]}>
        No active repeats or reminders.
      </Text>
    );
  }

  return (
    <View style={styles.scheduleOverview}>
      <View style={styles.scheduleSummaryRow}>
        <Text style={[styles.scheduleSummaryText, { color: theme.mutedText }]}>
          {repeatCount} repeats
        </Text>
        <Text style={[styles.scheduleSummaryText, { color: theme.mutedText }]}>
          {reminderCount} reminders
        </Text>
      </View>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          activeOpacity={0.82}
          onPress={() => onOpenTodo(item.entryId ?? item.todo.id)}
          style={[
            styles.scheduleCard,
            {
              backgroundColor: theme.control,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.scheduleCardHeader}>
            <View style={styles.scheduleTitleBlock}>
              <Text
                numberOfLines={1}
                style={[styles.scheduleTitle, { color: theme.text }]}
              >
                {item.todo.text.trim() || "Untitled"}
              </Text>
              <Text
                style={[styles.scheduleSource, { color: theme.subtleText }]}
              >
                {formatScheduleSource(item.source)}
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color={theme.mutedText} />
          </View>

          {item.todo.schedule ? (
            <View style={styles.scheduleToggleRow}>
              <View style={styles.scheduleLine}>
                <Text style={[styles.scheduleLineLabel, { color: theme.text }]}>
                  Repeat
                </Text>
                <Text
                  style={[
                    styles.scheduleLineValue,
                    { color: theme.mutedText },
                  ]}
                >
                  {formatSchedule(item.todo.schedule)}
                </Text>
              </View>
              <Switch
                value
                onValueChange={() => updateItem(item, { schedule: undefined })}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={theme.elevated}
              />
            </View>
          ) : null}

          {item.todo.reminder ? (
            <View style={styles.scheduleToggleRow}>
              <View style={styles.scheduleLine}>
                <Text style={[styles.scheduleLineLabel, { color: theme.text }]}>
                  Reminder
                </Text>
                <Text
                  style={[
                    styles.scheduleLineValue,
                    { color: theme.mutedText },
                  ]}
                >
                  {formatReminder(item.todo.reminder)}
                </Text>
              </View>
              <Switch
                value
                onValueChange={() => updateItem(item, { reminder: undefined })}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={theme.elevated}
              />
            </View>
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
  );
};

const getScheduleOverviewItems = (
  todos: Todo[],
  archivedTodos: Todo[],
  calendarEntries: CalendarEntry[],
): ScheduleOverviewItem[] => [
  ...todos
    .filter((todo) => todo.schedule || todo.reminder)
    .map((todo) => ({
      key: `daily-${todo.id}`,
      todo,
      source: "daily" as const,
    })),
  ...archivedTodos
    .filter((todo) => todo.schedule || todo.reminder)
    .map((todo) => ({
      key: `archive-${todo.id}`,
      todo,
      source: "archive" as const,
    })),
  ...calendarEntries
    .filter((entry) => entry.todo.schedule || entry.todo.reminder)
    .map((entry) => ({
      key: `calendar-${entry.id}`,
      todo: entry.todo,
      source: "calendar" as const,
      entryId: entry.id,
    })),
];

const formatSchedule = (schedule: TodoSchedule) => {
  const amount = schedule.amount ?? 1;
  const unit = singularizeUnit(schedule.unit, amount);
  const prefix = schedule.mode === "in" ? "in" : "every";
  const weekdayText =
    schedule.mode === "every" &&
    schedule.unit === "weeks" &&
    schedule.weekdays?.length
      ? `, ${formatWeekdays(schedule.weekdays)}`
      : "";
  const timeText = schedule.time ? ` at ${schedule.time}` : "";

  if (schedule.mode === "date" && schedule.targetDate) {
    return `on ${formatDate(schedule.targetDate)}${timeText}`;
  }

  return `${prefix} ${amount} ${unit}${weekdayText}${timeText}`;
};

const formatReminder = (reminder: TodoReminder) => {
  const amount = reminder.amount ?? 1;
  return `${amount} ${singularizeUnit(reminder.unit, amount)} before`;
};

const formatWeekdays = (weekdays: number[]) =>
  WEEKDAYS.filter((day) => weekdays.includes(day.value))
    .map((day) => day.label)
    .join(" ");

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
};

const formatScheduleSource = (source: ScheduleOverviewSource) => {
  if (source === "archive") return "Archive";
  if (source === "calendar") return "Calendar";
  return "Daily";
};

const singularizeUnit = (unit: string, amount: number) => {
  if (amount === 1 && unit.endsWith("s")) return unit.slice(0, -1);
  return unit;
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
  valueFormatter?: (value: number) => string;
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
  valueFormatter,
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
          {valueFormatter ? valueFormatter(value) : `${Math.round(value * 100)}%`}
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
  layoutControls: {
    gap: 10,
  },
  scheduleOverview: {
    gap: 10,
  },
  scheduleSummaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  scheduleSummaryText: {
    fontSize: 12,
    fontWeight: "700",
  },
  emptySchedulesText: {
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
  },
  scheduleCard: {
    borderRadius: 7,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  scheduleCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  scheduleTitleBlock: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  scheduleSource: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    textTransform: "uppercase",
  },
  scheduleToggleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  scheduleLine: {
    flex: 1,
  },
  scheduleLineLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  scheduleLineValue: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
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
  dataActions: {
    gap: 10,
  },
  trashHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  trashTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  trashTitle: {
    marginBottom: 0,
    marginTop: 0,
  },
  trashIconButton: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  emptyTrashText: {
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
  },
  trashList: {
    gap: 8,
  },
  trashItem: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 44,
  },
  trashItemText: {
    flex: 1,
  },
  trashItemTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  trashItemDate: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
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
