import React, { useState, useCallback, useMemo, useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { DateData, CalendarProvider } from "react-native-calendars";
import ExpandableCalendar from "react-native-calendars/src/expandableCalendar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CalendarEntries from "./CalendarEntries";
import {
  CalendarEntry,
  CalendarProjectionRange,
  DateFormatPreference,
  Project,
  Todo,
} from "../types";
import { buildCalendarProjections } from "../utils/calendarProjections";
import { useTheme } from "../utils/theme";

const { width } = Dimensions.get("window");

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (
    Number.isFinite(year) &&
    Number.isFinite(month) &&
    Number.isFinite(day)
  ) {
    return new Date(year, month - 1, day);
  }

  return new Date();
};

const getLocalDateKey = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
};

type FontWeight =
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900"
  | "normal"
  | "bold"
  | "ultralight"
  | "light"
  | "medium"
  | "regular"
  | "semibold"
  | "thin"
  | 100
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900;

interface CalendarTheme {
  backgroundColor?: string;
  calendarBackground?: string;
  textSectionTitleColor?: string;
  selectedDayBackgroundColor?: string;
  selectedDayTextColor?: string;
  todayTextColor?: string;
  dayTextColor?: string;
  textDisabledColor?: string;
  dotColor?: string;
  selectedDotColor?: string;
  arrowColor?: string;
  monthTextColor?: string;
  textMonthFontSize?: number;
  textMonthFontWeight?: FontWeight;
  textDayFontSize?: number;
  textDayHeaderFontSize?: number;
  textDayFontWeight?: FontWeight;
  textDayHeaderFontWeight?: FontWeight;
  "stylesheet.calendar.header"?: {
    week?: object;
    monthText?: object;
  };
}

interface CalendarProps {
  archivedTodos: Todo[];
  autoScrollToNow: boolean;
  dateFormat: DateFormatPreference;
  dayTimelineMode: boolean;
  focusedEntryId: number | null;
  projectionRange: CalendarProjectionRange;
  weekTimelineMode: boolean;
  viewMode: "day" | "week";
  onDateSelect: (date: string) => void;
  selectedDate: string;
  onAddEntry: () => Promise<Todo | CalendarEntry | undefined>;
  entries: CalendarEntry[];
  setEntries: React.Dispatch<React.SetStateAction<CalendarEntry[]>>;
  todos: Todo[]; // Add this
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>; // Add this
  updateTodo: (id: number, updates: Partial<Todo>) => void; // Add this
  projects: Project[];
  onOpenProjection: (todoId: number) => void;
}

const Calendar: React.FC<CalendarProps> = ({
  archivedTodos,
  autoScrollToNow,
  dateFormat,
  dayTimelineMode,
  focusedEntryId,
  projectionRange,
  weekTimelineMode,
  viewMode,
  onDateSelect,
  selectedDate,
  onAddEntry,
  entries,
  setEntries,
  todos,
  setTodos,
  updateTodo,
  projects,
  onOpenProjection,
}) => {
  const { theme: appTheme } = useTheme();
  const selectedDateObject = useMemo(
    () => parseDateKey(selectedDate),
    [selectedDate],
  );

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const savedEntries = await AsyncStorage.getItem("calendarEntries");
      if (savedEntries) {
        setEntries(JSON.parse(savedEntries));
      }
    } catch (error) {
      console.error("Error loading calendar entries:", error);
    }
  };

  const handleAddEntry = async () => {
    const newEntry = await onAddEntry();
    if (newEntry && "todo" in newEntry) {
      const entry = newEntry as CalendarEntry;
      setEntries((currentEntries: CalendarEntry[]) => [
        ...currentEntries,
        entry,
      ]);
    }
  };

  const events = useMemo(() => {
    const markedDates: { [key: string]: any } = {};
    entries.forEach((entry: CalendarEntry) => {
      const date = getLocalDateKey(new Date(entry.printedAt));
      if (!markedDates[date]) {
        markedDates[date] = { marked: true };
      }
    });
    return markedDates;
  }, [entries]);

  const projections = useMemo(
    () =>
      buildCalendarProjections({
        archivedTodos,
        calendarEntries: entries,
        range: projectionRange,
        todos,
      }),
    [archivedTodos, entries, projectionRange, todos],
  );

  const theme: CalendarTheme = useMemo(
    () => ({
      backgroundColor: appTheme.background,
      calendarBackground: appTheme.background,
      textSectionTitleColor: appTheme.mutedText,
      selectedDayBackgroundColor: appTheme.primary,
      selectedDayTextColor: appTheme.elevated,
      todayTextColor: appTheme.primary,
      dayTextColor: appTheme.text,
      textDisabledColor: appTheme.subtleText,
      dotColor: appTheme.primary,
      selectedDotColor: appTheme.elevated,
      arrowColor: appTheme.primary,
      monthTextColor: appTheme.text,
      textMonthFontSize: 16,
      textMonthFontWeight: "600",
      textDayFontSize: 16,
      textDayHeaderFontSize: 14,
      textDayFontWeight: "400",
      textDayHeaderFontWeight: "600",
      "stylesheet.calendar.header": {
        week: {
          marginTop: 5,
          flexDirection: "row",
          justifyContent: "space-around",
        },
        monthText: {
          fontSize: 16,
          fontWeight: "bold",
          color: appTheme.text,
          paddingVertical: 4,
        },
      },
    }),
    [appTheme],
  );

  const getWeekDates = (date: Date): Date[] => {
    const baseDate = new Date(date);
    const day = baseDate.getDay();
    const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(baseDate);
    monday.setDate(diff);

    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const nextDate = new Date(monday);
      nextDate.setDate(monday.getDate() + i);
      week.push(nextDate);
    }
    return week;
  };

  const formatDate = useCallback((date: Date): string => {
    return getLocalDateKey(date);
  }, []);

  const handleDateSelect = useCallback(
    (date: DateData) => {
      onDateSelect(date.dateString);
    },
    [onDateSelect],
  );

  const getMarkedDates = useCallback(() => {
    const marked = { ...events };
    const formattedSelectedDate = formatDate(selectedDateObject);

    marked[formattedSelectedDate] = {
      ...marked[formattedSelectedDate],
      selected: true,
      selectedColor: theme.selectedDayBackgroundColor,
      selectedTextColor: theme.selectedDayTextColor,
    };

    return marked;
  }, [
    events,
    selectedDateObject,
    theme.selectedDayBackgroundColor,
    theme.selectedDayTextColor,
    formatDate,
  ]);

  const handleDateChanged = useCallback(
    (date: string) => {
      onDateSelect(date);
    },
    [onDateSelect],
  );

  const weekDates = useMemo(
    () => getWeekDates(new Date(selectedDateObject)),
    [selectedDateObject],
  );

  return (
    <View
      style={[styles.calendarWrapper, { backgroundColor: appTheme.background }]}
    >
      <CalendarProvider
        date={formatDate(selectedDateObject)}
        onDateChanged={handleDateChanged}
        showTodayButton={false}
        disabledOpacity={0.6}
      >
        <ExpandableCalendar
          onDayPress={handleDateSelect}
          markedDates={getMarkedDates()}
          theme={theme}
          firstDay={1}
          calendarWidth={width - 20}
          allowShadow={false}
          hideKnob={false}
          closeOnDayPress={false}
        />
        <CalendarEntries
          selectedDate={formatDate(selectedDateObject)}
          autoScrollToNow={autoScrollToNow}
          dateFormat={dateFormat}
          focusedEntryId={focusedEntryId}
          entries={entries}
          setEntries={setEntries}
          dayTimelineMode={dayTimelineMode}
          weekTimelineMode={weekTimelineMode}
          viewMode={viewMode}
          weekDates={weekDates}
          onAddEntry={onAddEntry}
          todos={todos}
          setTodos={setTodos}
          updateTodo={updateTodo}
          projects={projects}
          projections={projections}
          onOpenProjection={onOpenProjection}
        />
      </CalendarProvider>
    </View>
  );
};

const styles = StyleSheet.create({
  calendarWrapper: {
    flex: 1,
    padding: 10,
    width: "100%",
  },
  calendarContent: {
    flex: 1,
    paddingTop: 20,
  },
});

export default Calendar;
