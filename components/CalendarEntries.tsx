import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  findNodeHandle,
  PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TodoItemNote from "./TodoItemNote";
import NoteTypeSelector from "./NoteTypeSelector";
import NoteScheduleSettings from "./NoteScheduleSettings";
import NoteSettingsSectionHeader from "./NoteSettingsSectionHeader";
import { CalendarEntry, Project, Todo } from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createTodoCopyFromCalendarEntry } from "../utils/calendarEntryActions";
import { normalizeNoteForType } from "../utils/checklist";
import { softHaptic, withLongPressHaptic } from "../utils/haptics";
import { getScrollYToRevealRange } from "../utils/scrollVisibility";
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
  projects: Project[];
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
  projects,
}) => {
  const { theme } = useTheme();
  const dayScrollRef = useRef<ScrollView>(null);
  const settingsRefByEntryId = useRef<Record<number, View | null>>({});
  const dayScrollYRef = useRef(0);
  const dayScrollPageYRef = useRef(0);
  const dayViewportHeightRef = useRef(0);
  const dayContentHeightRef = useRef(0);
  const [isNoteBodyDragging, setIsNoteBodyDragging] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showSettingsForId, setShowSettingsForId] = useState<number | null>(
    null,
  );
  const [showProjectPickerForId, setShowProjectPickerForId] = useState<
    number | null
  >(null);
  const [editingTimerId, setEditingTimerId] = useState<number | null>(null);
  const [draggingWeekEntryId, setDraggingWeekEntryId] = useState<number | null>(
    null,
  );
  const [armedWeekEntryId, setArmedWeekEntryId] = useState<number | null>(null);
  const [weekDragOffset, setWeekDragOffset] = useState({ x: 0, y: 0 });
  const armedWeekEntryIdRef = useRef<number | null>(null);
  const draggingWeekEntryIdRef = useRef<number | null>(null);
  const weekDragStartRef = useRef({ pageX: 0, pageY: 0 });
  const weekLastTapRef = useRef<{ id: number | null; timestamp: number }>({
    id: null,
    timestamp: 0,
  });

  const isMovableCalendarEntry = (entry: CalendarEntry) =>
    !entry.isTrackingEntry && !entry.timerCompleted;

  const persistCalendarEntries = async (nextEntries: CalendarEntry[]) => {
    setEntries(nextEntries);
    await AsyncStorage.setItem("calendarEntries", JSON.stringify(nextEntries));
  };

  const moveWeekEntryToDate = async (entry: CalendarEntry, targetDate: Date) => {
    const previousDate = new Date(entry.printedAt);
    const nextDate = new Date(targetDate);

    nextDate.setHours(
      previousDate.getHours(),
      previousDate.getMinutes(),
      previousDate.getSeconds(),
      previousDate.getMilliseconds(),
    );

    const nextPrintedAt = nextDate.toISOString();
    const updatedEntries = entries.map((currentEntry) =>
      currentEntry.id === entry.id
        ? {
            ...currentEntry,
            printedAt: nextPrintedAt,
            todo: {
              ...currentEntry.todo,
              schedule: updateScheduleTimeFromEntry(
                currentEntry,
                nextPrintedAt,
              ),
            },
          }
        : currentEntry,
    );

    await persistCalendarEntries(updatedEntries);
  };

  const createWeekEntryPanHandlers = (entry: CalendarEntry) => {
    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () =>
        armedWeekEntryIdRef.current === entry.id,
      onMoveShouldSetPanResponder: (_event, gestureState) =>
        armedWeekEntryIdRef.current === entry.id &&
        (Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3),
      onPanResponderGrant: (event) => {
        if (armedWeekEntryIdRef.current !== entry.id) return;

        draggingWeekEntryIdRef.current = entry.id;
        weekDragStartRef.current = {
          pageX: event.nativeEvent.pageX,
          pageY: event.nativeEvent.pageY,
        };
        setDraggingWeekEntryId(entry.id);
        setWeekDragOffset({ x: 0, y: 0 });
      },
      onPanResponderMove: (event) => {
        if (draggingWeekEntryIdRef.current !== entry.id) return;

        setWeekDragOffset({
          x: event.nativeEvent.pageX - weekDragStartRef.current.pageX,
          y: event.nativeEvent.pageY - weekDragStartRef.current.pageY,
        });
      },
      onPanResponderRelease: async (event) => {
        if (draggingWeekEntryIdRef.current !== entry.id) return;

        const dx = event.nativeEvent.pageX - weekDragStartRef.current.pageX;
        const startIndex = weekDates.findIndex(
          (date) =>
            date.toISOString().split("T")[0] ===
            new Date(entry.printedAt).toISOString().split("T")[0],
        );
        const fallbackIndex = Math.max(
          0,
          Math.min(weekDates.length - 1, startIndex + Math.round(dx / COLUMN_WIDTH)),
        );
        const nextDate = weekDates[fallbackIndex];

        draggingWeekEntryIdRef.current = null;
        armedWeekEntryIdRef.current = null;
        setDraggingWeekEntryId(null);
        setArmedWeekEntryId(null);
        setWeekDragOffset({ x: 0, y: 0 });

        if (nextDate) {
          await moveWeekEntryToDate(entry, nextDate);
        }
      },
      onPanResponderTerminate: () => {
        armedWeekEntryIdRef.current = null;
        draggingWeekEntryIdRef.current = null;
        setArmedWeekEntryId(null);
        setDraggingWeekEntryId(null);
        setWeekDragOffset({ x: 0, y: 0 });
      },
    });

    return panResponder.panHandlers;
  };

  const handleWeekEntryTouchStart = (
    entry: CalendarEntry,
  ) => {
    const now = Date.now();
    const isDoubleTap =
      weekLastTapRef.current.id === entry.id &&
      now - weekLastTapRef.current.timestamp < 320;

    weekLastTapRef.current = { id: entry.id, timestamp: now };

    if (!isDoubleTap || !isMovableCalendarEntry(entry)) {
      return;
    }

    softHaptic();
    armedWeekEntryIdRef.current = entry.id;
    setArmedWeekEntryId(entry.id);
    setWeekDragOffset({ x: 0, y: 0 });
  };

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

  const handleUpdateEntry = async (
    entryId: number,
    updates: Partial<CalendarEntry>,
  ) => {
    const updatedEntries = entries.map((entry) =>
      entry.id === entryId ? { ...entry, ...updates } : entry,
    );

    setEntries(updatedEntries);
    await AsyncStorage.setItem(
      "calendarEntries",
      JSON.stringify(updatedEntries),
    );
  };

  const handleUpdateEntryTodo = async (
    entry: CalendarEntry,
    updates: Partial<Todo>,
  ) => {
    await handleUpdateEntry(entry.id, {
      todo: { ...entry.todo, ...updates },
    });
  };

  const updateEntryTimeFromSchedule = (entry: CalendarEntry, time?: string) => {
    if (!time) return entry.printedAt;

    const match = time.match(/^(\d{2}):(\d{2})$/);
    if (!match) return entry.printedAt;

    const nextPrintedAt = new Date(entry.printedAt);
    nextPrintedAt.setHours(Number(match[1]), Number(match[2]), 0, 0);

    return nextPrintedAt.toISOString();
  };

  const updateScheduleTimeFromEntry = (
    entry: CalendarEntry,
    timestamp: string,
  ) => {
    if (!entry.todo.schedule) return undefined;

    const nextDate = new Date(timestamp);
    const time = `${String(nextDate.getHours()).padStart(2, "0")}:${String(
      nextDate.getMinutes(),
    ).padStart(2, "0")}`;
    const baseSchedule = {
      ...entry.todo.schedule,
      time,
      targetDate: timestamp,
      nextAt: timestamp,
    };

    if (entry.todo.schedule.mode !== "every") {
      return baseSchedule;
    }

    return {
      ...baseSchedule,
      startsAt: timestamp,
      weekdays:
        entry.todo.schedule.unit === "weeks"
          ? [nextDate.getDay()]
          : entry.todo.schedule.weekdays,
    };
  };

  const handleTitlePress = (entryId: number) => {
    const nextSettingsId = showSettingsForId === entryId ? null : entryId;
    setShowSettingsForId(nextSettingsId);

    if (nextSettingsId !== null) {
      setTimeout(() => scrollToEntrySettings(nextSettingsId), 80);
    }
  };

  const scrollToEntrySettings = (entryId: number) => {
    const settingsRef = settingsRefByEntryId.current[entryId];
    const scrollRef = dayScrollRef.current;
    const scrollNode = scrollRef ? findNodeHandle(scrollRef) : null;

    if (!settingsRef || !scrollRef || !scrollNode) return;

    settingsRef.measureLayout(
      scrollNode,
      (_x, y, _width, height) => {
        const viewportHeight = dayViewportHeightRef.current;
        const contentHeight = dayContentHeightRef.current;
        if (viewportHeight <= 0 || contentHeight <= 0) return;

        scrollRef.scrollTo({
          y: getScrollYToRevealRange({
            contentHeight,
            currentScrollY: dayScrollYRef.current,
            margin: 8,
            rangeHeight: height,
            rangeY: y,
            viewportHeight,
          }),
          animated: true,
        });
      },
      () => undefined,
    );
  };

  const handleNoteBodyDragChange = (isDragging: boolean) => {
    setIsNoteBodyDragging(isDragging);

    if (isDragging) {
      dayScrollRef.current &&
        (
          dayScrollRef.current as unknown as {
            measureInWindow: (
              callback: (
                x: number,
                y: number,
                width: number,
                height: number,
              ) => void,
            ) => void;
          }
        ).measureInWindow((_, pageY, __, height) => {
          dayScrollPageYRef.current = pageY;
          dayViewportHeightRef.current = height;
        });
    }
  };

  const handleNoteBodyDragMove = (pageY: number) => {
    const viewportHeight = dayViewportHeightRef.current;
    if (viewportHeight <= 0) return 0;

    const maxScrollY = Math.max(
      0,
      dayContentHeightRef.current - viewportHeight,
    );
    const edgeSize = 72;
    const distanceFromTop = pageY - dayScrollPageYRef.current;
    const distanceFromBottom =
      dayScrollPageYRef.current + viewportHeight - pageY;
    let delta = 0;

    if (distanceFromTop < edgeSize) {
      const pressure = Math.max(0, edgeSize - distanceFromTop) / edgeSize;
      delta = -Math.max(2, Math.round(pressure * 6));
    } else if (distanceFromBottom < edgeSize) {
      const pressure = Math.max(0, edgeSize - distanceFromBottom) / edgeSize;
      delta = Math.max(2, Math.round(pressure * 6));
    }

    if (delta === 0) return 0;

    const nextY = Math.max(
      0,
      Math.min(maxScrollY, dayScrollYRef.current + delta),
    );
    const appliedDelta = nextY - dayScrollYRef.current;

    if (appliedDelta === 0) return 0;

    dayScrollYRef.current = nextY;
    dayScrollRef.current?.scrollTo({ y: nextY, animated: false });
    return appliedDelta;
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

  const handleNoteTypeSelect = async (
    entry: CalendarEntry,
    noteType: Todo["noteType"],
    checkboxBehavior: Todo["checkboxBehavior"] = "simple",
  ) => {
    await handleUpdateEntryTodo(entry, {
      noteType,
      note: normalizeNoteForType(entry.todo.note, noteType),
      checkboxBehavior: noteType === "checkbox" ? checkboxBehavior : undefined,
    });
  };

  const handleProjectSelect = async (
    entry: CalendarEntry,
    projectId: number,
  ) => {
    await handleUpdateEntryTodo(entry, {
      projectId: entry.todo.projectId === projectId ? undefined : projectId,
    });
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
    try {
      const uniqueId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
      const timestamp = new Date().toISOString();
      const newTodo = createTodoCopyFromCalendarEntry(
        entry,
        uniqueId,
        timestamp,
      );

      setTodos((currentTodos: Todo[]) => {
        return [...currentTodos, newTodo];
      });

      try {
        const savedData = await AsyncStorage.getItem("todosData");
        const currentData = savedData
          ? JSON.parse(savedData)
          : { todos: [], archivedTodos: [], version: 1 };

        currentData.todos.push(newTodo);
        await AsyncStorage.setItem("todosData", JSON.stringify(currentData));

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
        ref={(ref) => {
          settingsRefByEntryId.current[entry.id] = ref;
        }}
        style={[
          styles.settingsContainer,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
        onLayout={() => {
          scrollToEntrySettings(entry.id);
        }}
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
        <NoteTypeSelector
          selectedType={entry.todo.noteType}
          checkboxBehavior={entry.todo.checkboxBehavior}
          onSelectType={(noteType) => handleNoteTypeSelect(entry, noteType)}
          onLongSelectType={(noteType) => {
            if (noteType === "checkbox") {
              softHaptic();
              handleNoteTypeSelect(entry, noteType, "completion");
            }
          }}
        />
        <NoteScheduleSettings
          schedule={entry.todo.schedule}
          reminder={entry.todo.reminder}
          onChange={(schedule) =>
            handleUpdateEntry(entry.id, {
              printedAt: updateEntryTimeFromSchedule(entry, schedule?.time),
              todo: { ...entry.todo, schedule },
            })
          }
          onReminderChange={(reminder) =>
            handleUpdateEntryTodo(entry, { reminder })
          }
        />
        {projects.length > 0 && (
          <View style={styles.projectSection}>
            <NoteSettingsSectionHeader
              title="Project"
              expanded={showProjectPickerForId === entry.id}
              onPress={() =>
                setShowProjectPickerForId((currentId) =>
                  currentId === entry.id ? null : entry.id,
                )
              }
            />

            {showProjectPickerForId === entry.id && (
              <View style={styles.projectChips}>
                {projects.map((project) => {
                  const isSelected = entry.todo.projectId === project.id;

                  return (
                    <TouchableOpacity
                      key={project.id}
                      onPress={() => handleProjectSelect(entry, project.id)}
                      activeOpacity={0.75}
                      style={[
                        styles.projectChip,
                        {
                          backgroundColor: isSelected
                            ? theme.primary
                            : theme.elevated,
                          borderColor: isSelected
                            ? theme.primary
                            : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.projectChipText,
                          { color: isSelected ? "#FFFFFF" : theme.text },
                        ]}
                      >
                        {project.title || "Untitled"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}
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
      <ScrollView
        ref={dayScrollRef}
        style={styles.dayContainer}
        scrollEnabled={!isNoteBodyDragging}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={(_, height) => {
          dayContentHeightRef.current = height;
        }}
        onLayout={(event) => {
          dayViewportHeightRef.current = event.nativeEvent.layout.height;
        }}
        onScroll={(event) => {
          dayScrollYRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
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
                    const updatedEntry = {
                      ...entry,
                      printedAt: newTimestamp,
                      todo: {
                        ...entry.todo,
                        schedule: updateScheduleTimeFromEntry(
                          entry,
                          newTimestamp,
                        ),
                      },
                    };
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
              onEndEditing={() => setIsNoteBodyDragging(false)}
              onListDragChange={handleNoteBodyDragChange}
              onListDragMove={handleNoteBodyDragMove}
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
        <ScrollView
          style={styles.weekContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.weekRow}>
            {weekDates.map((date) => {
              const dateStr = date.toISOString().split("T")[0];
              const dayEntries = entries
                .filter((entry) => {
                  const entryDate = new Date(entry.printedAt)
                    .toISOString()
                    .split("T")[0];
                  return entryDate === dateStr;
                })
                .sort((a, b) => {
                  const timeA = new Date(a.printedAt).getTime();
                  const timeB = new Date(b.printedAt).getTime();
                  return timeA - timeB;
                });

              return (
                <View key={dateStr} style={styles.dayColumn}>
                  {dayEntries.map((entry) => (
                    <View
                      key={entry.id}
                      onTouchEnd={() => handleWeekEntryTouchStart(entry)}
                      style={[
                        styles.weekEntryItem,
                        draggingWeekEntryId === entry.id && {
                          transform: [
                            { translateX: weekDragOffset.x },
                            { translateY: weekDragOffset.y },
                            { scale: 1.03 },
                          ],
                          zIndex: 10,
                          elevation: 8,
                        },
                      ]}
                      {...createWeekEntryPanHandlers(entry)}
                    >
                      <View
                        style={[
                          styles.weekEntryContent,
                          armedWeekEntryId === entry.id &&
                            styles.weekEntryArmed,
                          draggingWeekEntryId === entry.id &&
                            styles.weekEntryArmed,
                          !isMovableCalendarEntry(entry) &&
                            styles.weekEntryLocked,
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
    borderTopWidth: 3,
    borderTopColor: "transparent",
  },
  weekEntryArmed: {
    borderTopColor: "#2563eb",
  },
  weekEntryLocked: {
    opacity: 0.78,
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
  projectSection: {
    marginTop: 0,
    marginBottom: 12,
  },
  projectChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 4,
  },
  projectChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  projectChipText: {
    fontSize: 14,
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
