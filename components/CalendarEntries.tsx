import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TodoItemNote from "./TodoItemNote";
import { CalendarEntry, Todo } from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { softHaptic, withLongPressHaptic } from "../utils/haptics";
import { getNoteBackgroundColor, useTheme } from "../utils/theme";

const { width } = Dimensions.get("window");
const COLUMN_WIDTH = (width - 40) / 7;

interface CalendarEntriesProps {
  selectedDate: string | null;
  entries: CalendarEntry[];
  setEntries: React.Dispatch<React.SetStateAction<CalendarEntry[]>>;
  viewMode: "week" | "day";
  weekDates: Date[];
  onAddEntry: () => Promise<Todo | CalendarEntry | undefined>;
  todos: Todo[]; // Add this
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
}

const CalendarEntries: React.FC<CalendarEntriesProps> = ({
  selectedDate,
  entries,
  setEntries,
  viewMode,
  weekDates,
  onAddEntry,
  todos,
  setTodos,
  updateTodo,
}) => {
  const { theme } = useTheme();
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showSettingsForId, setShowSettingsForId] = useState<number | null>(
    null,
  );
  const [editingTimerId, setEditingTimerId] = useState<number | null>(null);

  const formatElapsedTime = (elapsedMinutes: number): string => {
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;

    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const handleUpdateNote = async (entryId: number, newNote: string) => {
    const updatedEntries = entries.map((entry) =>
      entry.id === entryId
        ? {
            ...entry,
            todo: { ...entry.todo, note: newNote },
          }
        : entry,
    );

    setEntries(updatedEntries);
    await AsyncStorage.setItem(
      "calendarEntries",
      JSON.stringify(updatedEntries),
    );
  };

  const handleStartTitleEditing = (entry: CalendarEntry) => {
    setEditingTitleId(entry.id);
    setEditingText(entry.todo.text);
  };

  const handleEndTitleEditing = async (entryId: number) => {
    const updatedEntries = entries.map((entry) =>
      entry.id === entryId
        ? {
            ...entry,
            todo: { ...entry.todo, text: editingText },
          }
        : entry,
    );

    setEntries(updatedEntries);
    setEditingTitleId(null);
    await AsyncStorage.setItem(
      "calendarEntries",
      JSON.stringify(updatedEntries),
    );
  };

  const handleDeleteEntry = async (entryId: number) => {
    const updatedEntries = entries.filter((entry) => entry.id !== entryId);
    setEntries(updatedEntries);
    await AsyncStorage.setItem(
      "calendarEntries",
      JSON.stringify(updatedEntries),
    );
  };

  const handleTitlePress = (entryId: number) => {
    setShowSettingsForId(showSettingsForId === entryId ? null : entryId);
  };

  const getColorValue = (buttonColor: string): string => {
    switch (buttonColor) {
      case "#ff6b6b":
        return "red";
      case "#ffd93d":
        return "yellow";
      case "#6bcb77":
        return "green";
      case "#4d96ff":
        return "blue";
      default:
        return "blue";
    }
  };

  const handleColorChange = async (entryId: number, buttonColor: string) => {
    const color = getColorValue(buttonColor);

    const updatedEntries = entries.map((entry) =>
      entry.id === entryId
        ? {
            ...entry,
            todo: { ...entry.todo, color },
          }
        : entry,
    );

    setEntries(updatedEntries);
    await AsyncStorage.setItem(
      "calendarEntries",
      JSON.stringify(updatedEntries),
    );
  };

  interface CalendarEntriesProps {
    selectedDate: string | null;
    entries: CalendarEntry[];
    setEntries: React.Dispatch<React.SetStateAction<CalendarEntry[]>>;
    viewMode: "week" | "day";
    weekDates: Date[];
    onAddEntry: () => Promise<Todo | CalendarEntry | undefined>;
    todos: Todo[]; // Add this
    setTodos: React.Dispatch<React.SetStateAction<Todo[]>>; // Add this
    updateTodo: (id: number, updates: Partial<Todo>) => void; // Add this
  }

  const handleUnarchiveEntry = async (entry: CalendarEntry) => {
    const entryDate = new Date(entry.printedAt).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];
    const isFutureOrToday = entryDate >= today;

    try {
      const uniqueId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

      const newTodo: Todo = {
        ...entry.todo,
        id: uniqueId,
        isEditing: false,
        createdAt: new Date().toISOString(),
        restoredFrom: {
          type: "calendar",
          originalId: entry.id,
          timestamp: new Date().toISOString(),
        },
      };

      // Fix typing for setTodos callback
      setTodos((currentTodos: Todo[]) => {
        const isDuplicate = currentTodos.some(
          (todo: Todo) =>
            todo.text === newTodo.text &&
            todo.note === newTodo.note &&
            Math.abs(
              new Date(todo.createdAt || 0).getTime() -
                new Date(entry.printedAt).getTime(),
            ) < 1000,
        );

        if (isDuplicate) {
          console.warn("Duplicate todo detected, skipping...");
          return currentTodos;
        }

        return [...currentTodos, newTodo];
      });

      try {
        const savedData = await AsyncStorage.getItem("todosData");
        const currentData = savedData
          ? JSON.parse(savedData)
          : { todos: [], archivedTodos: [], version: 1 };

        const isDuplicateInStorage = currentData.todos.some(
          (todo: Todo) =>
            todo.text === newTodo.text &&
            todo.note === newTodo.note &&
            Math.abs(
              new Date(todo.createdAt || 0).getTime() -
                new Date(entry.printedAt).getTime(),
            ) < 1000,
        );

        if (!isDuplicateInStorage) {
          currentData.todos.push(newTodo);
          await AsyncStorage.setItem("todosData", JSON.stringify(currentData));
        }

        if (isFutureOrToday) {
          const updatedEntries = entries.filter((e) => e.id !== entry.id);
          setEntries(updatedEntries);
          await AsyncStorage.setItem(
            "calendarEntries",
            JSON.stringify(updatedEntries),
          );
        }

        setShowSettingsForId(null);
      } catch (error) {
        console.error("Error saving to AsyncStorage:", error);
      }
    } catch (error) {
      console.error("Error handling unarchive:", error);
    }
  };

  const renderSettings = (entry: CalendarEntry) => {
    if (showSettingsForId !== entry.id) return null;

    return (
      <View
        style={[
          styles.settingsContainer,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.colorPalette}>
          <TouchableOpacity
            style={[
              styles.colorButton,
              { backgroundColor: "#ff6b6b" },
              entry.todo.color === "red" && [
                styles.selectedColor,
                { borderColor: theme.text },
              ],
            ]}
            onPress={() => handleColorChange(entry.id, "#ff6b6b")}
          />
          <TouchableOpacity
            style={[
              styles.colorButton,
              { backgroundColor: "#ffd93d" },
              entry.todo.color === "yellow" && [
                styles.selectedColor,
                { borderColor: theme.text },
              ],
            ]}
            onPress={() => handleColorChange(entry.id, "#ffd93d")}
          />
          <TouchableOpacity
            style={[
              styles.colorButton,
              { backgroundColor: "#6bcb77" },
              entry.todo.color === "green" && [
                styles.selectedColor,
                { borderColor: theme.text },
              ],
            ]}
            onPress={() => handleColorChange(entry.id, "#6bcb77")}
          />
          <TouchableOpacity
            style={[
              styles.colorButton,
              { backgroundColor: "#4d96ff" },
              entry.todo.color === "blue" && [
                styles.selectedColor,
                { borderColor: theme.text },
              ],
            ]}
            onPress={() => handleColorChange(entry.id, "#4d96ff")}
          />
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.iconButton}
            onLongPress={() => {
              softHaptic();
              handleUnarchiveEntry(entry);
            }}
            delayLongPress={700}
          >
            <Ionicons
              name="archive-outline"
              size={24}
              color={theme.mutedText}
              style={{ transform: [{ rotate: "180deg" }] }}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onLongPress={withLongPressHaptic(() => handleDeleteEntry(entry.id))}
            delayLongPress={700}
          >
            <Ionicons name="trash-outline" size={24} color={theme.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderTimerInfo = (entry: CalendarEntry) => {
    const elapsed = entry.timeSpent?.elapsed ?? 0;

    const isEditing = editingTimerId === entry.id;

    return (
      <TouchableOpacity
        style={[
          styles.timerInfo,
          { backgroundColor: theme.control, borderColor: theme.border },
        ]}
        onLongPress={() => {
          softHaptic();
          setEditingTimerId(entry.id);
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="time" size={13} color={theme.mutedText} />

        {isEditing ? (
          <TextInput
            style={[styles.timerInput, { color: theme.mutedText }]}
            value={String(elapsed)}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
            onBlur={() => setEditingTimerId(null)}
            onChangeText={async (text) => {
              const numericText = text.replace(/\D/g, "");
              const newElapsed = numericText ? parseInt(numericText, 10) : 0;

              const updatedEntries = entries.map((e) =>
                e.id === entry.id
                  ? {
                      ...e,
                      timeSpent: {
                        elapsed: newElapsed,
                      },
                    }
                  : e,
              );

              setEntries(updatedEntries);

              await AsyncStorage.setItem(
                "calendarEntries",
                JSON.stringify(updatedEntries),
              );
            }}
          />
        ) : elapsed > 0 ? (
          <>
            <Text style={[styles.timerNumber, { color: theme.mutedText }]}>
              {elapsed}
            </Text>
            <Text style={[styles.timerText, { color: theme.mutedText }]}>
              m
            </Text>
          </>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderTodoText = (entry: CalendarEntry) => {
    if (editingTitleId === entry.id) {
      return (
        <TextInput
          value={editingText}
          onChangeText={setEditingText}
          onBlur={() => handleEndTitleEditing(entry.id)}
          style={[styles.todoText, styles.todoInput, { color: theme.text }]}
          autoFocus
        />
      );
    }
    return (
      <Text
        style={[styles.todoText, { color: theme.text }]}
        numberOfLines={1}
        onPress={() => handleTitlePress(entry.id)}
        onLongPress={withLongPressHaptic(() => handleStartTitleEditing(entry))}
      >
        {entry.todo.text || "Untitled Note"}
      </Text>
    );
  };

  const renderDayView = () => {
    if (!selectedDate) {
      return (
        <View style={styles.container}>
          <Text style={[styles.placeholder, { color: theme.mutedText }]}>
            Select a date to view entries
          </Text>
        </View>
      );
    }

    // Filter entries for the selected date and sort them by time
    const dateEntries = entries
      .filter((entry) => {
        const entryDate = new Date(entry.printedAt).toISOString().split("T")[0];
        return entryDate === selectedDate;
      })
      .sort((a, b) => {
        const timeA = new Date(a.printedAt).getTime();
        const timeB = new Date(b.printedAt).getTime();
        return timeA - timeB;
      });

    if (dateEntries.length === 0) {
      return (
        <Text style={[styles.placeholder, { color: theme.mutedText }]}>
          No entries for this date
        </Text>
      );
    }

    return (
      <ScrollView style={styles.dayContainer}>
        {dateEntries.map((entry) => (
          <View key={entry.id} style={styles.entryContainer}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                {renderTodoText(entry)}
                {renderTimerInfo(entry)}
              </View>
              <View style={styles.headerRight}>
                <TimeEditor
                  timestamp={entry.printedAt}
                  onSave={async (newTimestamp) => {
                    const updatedEntry = { ...entry, printedAt: newTimestamp };
                    // Remove the old entry and add the updated one
                    const updatedEntries = entries
                      .filter((e) => e.id !== entry.id)
                      .concat(updatedEntry)
                      // Re-sort after update
                      .sort((a, b) => {
                        const timeA = new Date(a.printedAt).getTime();
                        const timeB = new Date(b.printedAt).getTime();
                        return timeA - timeB;
                      });

                    setEntries(updatedEntries);
                    await AsyncStorage.setItem(
                      "calendarEntries",
                      JSON.stringify(updatedEntries),
                    );
                  }}
                />
              </View>
            </View>
            <TodoItemNote
              todo={entry.todo}
              updateNote={(note) => handleUpdateNote(entry.id, note)}
              onStartEditing={() => {}}
              onEndEditing={() => {}}
            />
            {renderSettings(entry)}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderWeekView = () => {
    return (
      <View style={styles.weekContainer}>
        <ScrollView style={styles.weekContent}>
          <View style={styles.weekRow}>
            {weekDates.map((date) => {
              const dateStr = date.toISOString().split("T")[0];
              const dayEntries = entries.filter((entry) => {
                const entryDate = new Date(entry.printedAt)
                  .toISOString()
                  .split("T")[0];
                return entryDate === dateStr;
              });

              return (
                <View key={dateStr} style={styles.dayColumn}>
                  {dayEntries.map((entry) => (
                    <View key={entry.id} style={styles.weekEntryItem}>
                      <View
                        style={[
                          styles.weekEntryContent,
                          {
                            backgroundColor: getNoteBackgroundColor(
                              entry.todo.color,
                              theme,
                            ),
                          },
                        ]}
                      >
                        {editingTitleId === entry.id ? (
                          <TextInput
                            value={editingText}
                            onChangeText={setEditingText}
                            onBlur={() => handleEndTitleEditing(entry.id)}
                            style={[
                              styles.weekEntryText,
                              styles.todoInput,
                              { color: theme.text },
                            ]}
                            autoFocus
                            multiline
                          />
                        ) : (
                          <Text
                            style={[
                              styles.weekEntryText,
                              { color: theme.text },
                            ]}
                            onLongPress={withLongPressHaptic(() =>
                              handleStartTitleEditing(entry),
                            )}
                          >
                            {entry.todo.text || ""}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  return viewMode === "day" ? (
    <View style={styles.container}>{renderDayView()}</View>
  ) : (
    <View style={styles.container}>{renderWeekView()}</View>
  );
};

const TimeEditor = ({
  timestamp,
  onSave,
}: {
  timestamp: string;
  onSave: (newTimestamp: string) => void;
}) => {
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const hoursRef = useRef<TextInput>(null);
  const minutesRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isEditing) {
      const time = new Date(timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const [h, m] = time.split(":");
      setHours(h);
      setMinutes(m);
    }
  }, [isEditing, timestamp]);

  const handleHoursChange = (text: string) => {
    const numericText = text.replace(/\D/g, "");
    const h = parseInt(numericText);

    if (numericText.length === 2 || (h >= 0 && h <= 23)) {
      setHours(numericText);
      if (numericText.length === 2 && h >= 0 && h <= 23) {
        minutesRef.current?.focus();
      }
    }
  };

  const handleMinutesChange = (text: string) => {
    const numericText = text.replace(/\D/g, "");
    const m = parseInt(numericText);

    if (numericText.length === 2 || (m >= 0 && m <= 59)) {
      setMinutes(numericText);
      if (numericText.length === 2 && m >= 0 && m <= 59) {
        saveTime(parseInt(hours), m);
      }
    }
  };

  const saveTime = (h: number, m: number) => {
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      const date = new Date(timestamp);
      date.setHours(h, m);
      onSave(date.toISOString());
      setIsEditing(false);
    }
  };

  const handleHoursBlur = () => {
    const h = parseInt(hours);
    if (isNaN(h) || h < 0 || h > 23) {
      resetTime();
    }
  };

  const handleMinutesBlur = () => {
    const m = parseInt(minutes);
    if (isNaN(m) || m < 0 || m > 59) {
      resetTime();
    } else {
      saveTime(parseInt(hours), m);
    }
  };

  const resetTime = () => {
    const time = new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const [h, m] = time.split(":");
    setHours(h);
    setMinutes(m);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <Text
        style={[styles.timestamp, { color: theme.mutedText }]}
        onLongPress={() => {
          softHaptic();
          setIsEditing(true);
          setTimeout(() => hoursRef.current?.focus(), 50);
        }}
      >
        {new Date(timestamp).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })}
      </Text>
    );
  }

  return (
    <View
      style={[
        styles.timeEditContainer,
        { backgroundColor: theme.control, borderColor: theme.border },
      ]}
    >
      <TextInput
        ref={hoursRef}
        style={[styles.timeInput, { color: theme.mutedText }]}
        value={hours}
        onChangeText={handleHoursChange}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
        onBlur={handleHoursBlur}
      />
      <Text style={[styles.timeColon, { color: theme.mutedText }]}>:</Text>
      <TextInput
        ref={minutesRef}
        style={[styles.timeInput, { color: theme.mutedText }]}
        value={minutes}
        onChangeText={handleMinutesChange}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
        onBlur={handleMinutesBlur}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  dayContainer: {
    flex: 1,
  },
  placeholder: {
    textAlign: "center",
    color: "#666",
    padding: 20,
  },
  entryContainer: {
    marginBottom: 15,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  todoText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1f2937",
    flex: 1,
  },
  todoInput: {
    padding: 0,
    margin: 0,
  },
  timestamp: {
    fontSize: 12,
    color: "#6b7280",
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  timerInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 2,
    gap: 0,
  },
  timerNumber: {
    fontSize: 12,
    color: "#6b7280",
    marginLeft: 1,
    marginRight: 0,
  },
  timerText: {
    fontSize: 11,
    color: "#6b7280",
    marginLeft: 0,
  },
  weekContainer: {
    flex: 1,
    marginTop: 10,
  },
  weekContent: {
    flex: 1,
  },
  weekRow: {
    flexDirection: "row",
    paddingTop: 1,
  },
  dayColumn: {
    width: COLUMN_WIDTH,
    minHeight: 50,
    alignItems: "center",
  },
  weekEntryItem: {
    paddingHorizontal: 3,
    paddingVertical: 4,
    width: COLUMN_WIDTH - 4,
    minHeight: 38,
  },
  weekEntryContent: {
    padding: 2,
    borderRadius: 4,
    flex: 1,
    justifyContent: "center",
  },
  weekEntryText: {
    fontSize: 12,
    color: "#1f2937",
    flexWrap: "wrap",
    textAlign: "center",
  },
  settingsContainer: {
    padding: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderRadius: 4,
    marginTop: 8,
  },
  colorPalette: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
    marginTop: 10,
  },
  colorButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
    marginBottom: 10,
  },
  iconButton: {
    padding: 10,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedColor: {
    borderWidth: 2,
    borderColor: "#4b5563",
  },
  timeEditContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 6,
    paddingHorizontal: 4,
  },
  timeInput: {
    fontSize: 12,
    color: "#6b7280",
    padding: 0,
    width: 20,
    textAlign: "center",
  },
  timeColon: {
    fontSize: 12,
    color: "#6b7280",
    marginHorizontal: 2,
  },
  timerInput: {
    fontSize: 12,
    color: "#6b7280",
    padding: 0,
    margin: 0,
    width: 18,
    textAlign: "center",
  },
});

export default CalendarEntries;
