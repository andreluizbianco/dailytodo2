import React, { useState, useRef, useEffect, useMemo } from "react";
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
import { getProjectDisplayLabel } from "../utils/projectLabels";
import { CalendarEntry, DateFormatPreference, Project, Todo } from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createTodoCopyFromCalendarEntry } from "../utils/calendarEntryActions";
import { CalendarProjection } from "../utils/calendarProjections";
import { normalizeNoteForType } from "../utils/checklist";
import { getCalendarAutoScrollKey } from "../utils/calendarAutoScroll";
import { softHaptic, withLongPressHaptic } from "../utils/haptics";
import { getScrollYToRevealRange } from "../utils/scrollVisibility";
import { getNoteBackgroundColor, useTheme } from "../utils/theme";

const { width } = Dimensions.get("window");
const COLUMN_WIDTH = (width - 40) / 7;
const TIMELINE_HOUR_HEIGHT = 72;
const TIMELINE_MINUTE_HEIGHT = TIMELINE_HOUR_HEIGHT / 60;
const TIMELINE_LABEL_WIDTH = 16;
const WEEK_TIMELINE_LABEL_WIDTH = 18;
const WEEK_TIMELINE_GUTTER_WIDTH = 14;

interface CalendarEntriesProps {
  autoScrollToNow: boolean;
  dateFormat: DateFormatPreference;
  focusedEntryId: number | null;
  selectedDate: string | null;
  entries: CalendarEntry[];
  setEntries: React.Dispatch<React.SetStateAction<CalendarEntry[]>>;
  dayTimelineMode: boolean;
  weekTimelineMode: boolean;
  viewMode: "week" | "day";
  weekDates: Date[];
  onAddEntry: () => Promise<Todo | CalendarEntry | undefined>;
  todos: Todo[]; // Add this
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
  projects: Project[];
  projections: CalendarProjection[];
  onOpenProjection: (todoId: number) => void;
}

type DisplayCalendarEntry = CalendarEntry & {
  isProjection?: boolean;
  projectionKey?: string;
  projectionSourceTodoId?: number;
  segmentDurationMinutes?: number;
  segmentStartMinutes?: number;
  segmentKey?: string;
};

const getProjectionNumericId = (projectionId: string) => {
  let hash = 0;
  for (let index = 0; index < projectionId.length; index += 1) {
    hash = (hash * 31 + projectionId.charCodeAt(index)) | 0;
  }

  return -Math.abs(hash || 1);
};

const createProjectionEntry = (
  projection: CalendarProjection,
): DisplayCalendarEntry => ({
  id: getProjectionNumericId(projection.id),
  todo: projection.todo,
  printedAt: projection.printedAt,
  showInDaily: false,
  isProjection: true,
  projectionKey: projection.id,
  projectionSourceTodoId: projection.todo.id,
});

const isProjectionEntry = (
  entry: CalendarEntry,
): entry is DisplayCalendarEntry => {
  return (entry as DisplayCalendarEntry).isProjection === true;
};

const getDisplayEntryKey = (entry: CalendarEntry) => {
  const displayEntry = entry as DisplayCalendarEntry;
  if (displayEntry.segmentKey) return displayEntry.segmentKey;

  const projectionKey = displayEntry.projectionKey;
  return projectionKey ? `projection-${projectionKey}` : `entry-${entry.id}`;
};

const CalendarEntries: React.FC<CalendarEntriesProps> = ({
  autoScrollToNow,
  dateFormat,
  focusedEntryId,
  selectedDate,
  entries,
  setEntries,
  dayTimelineMode,
  weekTimelineMode,
  viewMode,
  weekDates,
  onAddEntry,
  todos,
  setTodos,
  updateTodo,
  projects,
  projections,
  onOpenProjection,
}) => {
  const { theme } = useTheme();
  const dayScrollRef = useRef<ScrollView>(null);
  const timelineScrollRef = useRef<ScrollView>(null);
  const settingsRefByEntryId = useRef<Record<number, View | null>>({});
  const entryRefByEntryId = useRef<Record<number, View | null>>({});
  const lastAutoScrollKeyRef = useRef<string | null>(null);
  const dayScrollYRef = useRef(0);
  const dayScrollPageYRef = useRef(0);
  const dayViewportHeightRef = useRef(0);
  const dayContentHeightRef = useRef(0);
  const timelineViewportHeightRef = useRef(0);
  const timelineContentHeightRef = useRef(0);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isNoteBodyDragging, setIsNoteBodyDragging] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showSettingsForId, setShowSettingsForId] = useState<number | null>(
    null,
  );
  const [showProjectPickerForId, setShowProjectPickerForId] = useState<
    number | null
  >(null);
  const [expandedProjectParentByEntryId, setExpandedProjectParentByEntryId] =
    useState<Record<number, number | null>>({});
  const projectionEntries = useMemo(
    () => projections.map(createProjectionEntry),
    [projections],
  );
  const [editingTimerId, setEditingTimerId] = useState<number | null>(null);
  const [draggingWeekEntryId, setDraggingWeekEntryId] = useState<number | null>(
    null,
  );
  const [draggingWeekTimelineEntryId, setDraggingWeekTimelineEntryId] =
    useState<number | null>(null);
  const [armedTimelineEntryId, setArmedTimelineEntryId] = useState<
    number | null
  >(null);
  const [weekTimelineDropPreview, setWeekTimelineDropPreview] = useState<{
    dayIndex: number;
    minutes: number;
  } | null>(null);
  const [armedWeekEntryId, setArmedWeekEntryId] = useState<number | null>(null);
  const [draggingDayEntryId, setDraggingDayEntryId] = useState<number | null>(
    null,
  );
  const [dayDragOffsetY, setDayDragOffsetY] = useState(0);
  const draggingDayEntryIdRef = useRef<number | null>(null);
  const dayDragStartRef = useRef({ pageY: 0, startMinutes: 0 });
  const [weekDragOffset, setWeekDragOffset] = useState({ x: 0, y: 0 });
  const armedWeekEntryIdRef = useRef<number | null>(null);
  const armedTimelineEntryIdRef = useRef<number | null>(null);
  const draggingWeekEntryIdRef = useRef<number | null>(null);
  const draggingWeekTimelineEntryIdRef = useRef<number | null>(null);
  const weekTimelineDragStartRef = useRef({
    pageX: 0,
    pageY: 0,
    startDayIndex: 0,
    startMinutes: 0,
  });
  const weekDragStartRef = useRef({ pageX: 0, pageY: 0 });
  const weekLastTapRef = useRef<{ id: number | null; timestamp: number }>({
    id: null,
    timestamp: 0,
  });
  const timelineLastTapRef = useRef<{ id: number | null; timestamp: number }>({
    id: null,
    timestamp: 0,
  });

  const isMovableCalendarEntry = (entry: CalendarEntry) =>
    !isProjectionEntry(entry) && !entry.isTrackingEntry && !entry.timerCompleted;

  const handleProjectionPress = (entry: CalendarEntry) => {
    if (!isProjectionEntry(entry) || !entry.projectionSourceTodoId) return;
    onOpenProjection(entry.projectionSourceTodoId);
  };

  useEffect(() => {
    const intervalId = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(intervalId);
  }, []);

  const snapMinutesToStep = (minutes: number, step = 5) => {
    return Math.max(0, Math.min(23 * 60 + 55, Math.round(minutes / step) * step));
  };

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

  const moveDayEntryToMinutes = async (
    entry: CalendarEntry,
    nextMinutes: number,
  ) => {
    const nextDate = new Date(entry.printedAt);
    nextDate.setHours(Math.floor(nextMinutes / 60), nextMinutes % 60, 0, 0);
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

  const moveWeekTimelineEntry = async (
    entry: CalendarEntry,
    targetDate: Date,
    nextMinutes: number,
  ) => {
    const nextDate = new Date(targetDate);
    nextDate.setHours(Math.floor(nextMinutes / 60), nextMinutes % 60, 0, 0);
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

  const getWeekTimelineDropPreview = (dx: number, dy: number) => {
    const dayDelta = Math.round(dx / COLUMN_WIDTH);
    const dayIndex = Math.max(
      0,
      Math.min(
        weekDates.length - 1,
        weekTimelineDragStartRef.current.startDayIndex + dayDelta,
      ),
    );
    const minuteDelta = dy / TIMELINE_MINUTE_HEIGHT;
    const minutes = snapMinutesToStep(
      weekTimelineDragStartRef.current.startMinutes + minuteDelta,
    );

    return { dayIndex, minutes };
  };

  const formatTimelineMinutes = (minutes: number) => {
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
      minutes % 60,
    ).padStart(2, "0")}`;
  };

  const getLocalDayKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const isSelectedDateToday = () =>
    Boolean(selectedDate) && selectedDate === getLocalDayKey(currentTime);

  const getCurrentMinutes = () =>
    currentTime.getHours() * 60 + currentTime.getMinutes();

  const scrollTimelineToCurrentTime = (startHour: number) => {
    if (!autoScrollToNow || !isSelectedDateToday()) return;

    requestAnimationFrame(() => {
      const currentTop =
        (getCurrentMinutes() - startHour * 60) * TIMELINE_MINUTE_HEIGHT;
      const viewportHeight = timelineViewportHeightRef.current;
      const contentHeight = timelineContentHeightRef.current;
      if (viewportHeight <= 0 || contentHeight <= 0) return;

      timelineScrollRef.current?.scrollTo({
        y: Math.max(
          0,
          Math.min(
            currentTop - viewportHeight / 2,
            Math.max(0, contentHeight - viewportHeight),
          ),
        ),
        animated: true,
      });
    });
  };

  const scheduleScrollTimelineToCurrentTime = (startHour: number) => {
    setTimeout(() => scrollTimelineToCurrentTime(startHour), 320);
  };

  const scrollDayListToCurrentEntry = (dateEntries: CalendarEntry[]) => {
    if (!autoScrollToNow || dayTimelineMode || !isSelectedDateToday()) return;

    const nowMinutes = getCurrentMinutes();
    const sortedEntries = [...dateEntries].sort(
      (a, b) => getEntryStartMinutes(a) - getEntryStartMinutes(b),
    );
    const targetEntry =
      sortedEntries.find(
        (entry) => getEntryStartMinutes(entry) >= nowMinutes - 30,
      ) ?? null;
    if (!targetEntry) return;

    setTimeout(() => {
      const entryRef = entryRefByEntryId.current[targetEntry.id];
      const scrollRef = dayScrollRef.current;
      const scrollNode = scrollRef ? findNodeHandle(scrollRef) : null;
      if (!entryRef || !scrollRef || !scrollNode) return;

      entryRef.measureLayout(
        scrollNode,
        (_x, y) => {
          const viewportHeight = dayViewportHeightRef.current;
          const contentHeight = dayContentHeightRef.current;
          const maxY = Math.max(0, contentHeight - viewportHeight);
          scrollRef.scrollTo({
            y: Math.max(0, Math.min(y - 8, maxY)),
            animated: true,
          });
        },
        () => undefined,
      );
    }, 120);
  };

  const scrollDayListToEntry = (entryId: number) => {
    setTimeout(() => {
      const entryRef = entryRefByEntryId.current[entryId];
      const scrollRef = dayScrollRef.current;
      const scrollNode = scrollRef ? findNodeHandle(scrollRef) : null;
      if (!entryRef || !scrollRef || !scrollNode) return;

      entryRef.measureLayout(
        scrollNode,
        (_x, y) => {
          const viewportHeight = dayViewportHeightRef.current;
          const contentHeight = dayContentHeightRef.current;
          const maxY = Math.max(0, contentHeight - viewportHeight);
          scrollRef.scrollTo({
            y: Math.max(0, Math.min(y - 8, maxY)),
            animated: true,
          });
        },
        () => undefined,
      );
    }, 140);
  };

  const scrollTimelineToEntry = (
    entry: CalendarEntry,
    startHour: number,
  ) => {
    requestAnimationFrame(() => {
      const entryTop =
        (getEntryStartMinutes(entry) - startHour * 60) *
        TIMELINE_MINUTE_HEIGHT;
      const viewportHeight = timelineViewportHeightRef.current;
      const contentHeight = timelineContentHeightRef.current;
      if (viewportHeight <= 0 || contentHeight <= 0) return;

      timelineScrollRef.current?.scrollTo({
        y: Math.max(
          0,
          Math.min(
            entryTop - viewportHeight / 2,
            Math.max(0, contentHeight - viewportHeight),
          ),
        ),
        animated: true,
      });
    });
  };

  const createDayTimelinePanHandlers = (entry: CalendarEntry) => {
    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () =>
        isMovableCalendarEntry(entry) &&
        armedTimelineEntryIdRef.current === entry.id,
      onMoveShouldSetPanResponder: (_event, gestureState) =>
        isMovableCalendarEntry(entry) &&
        armedTimelineEntryIdRef.current === entry.id &&
        Math.abs(gestureState.dy) > 3,
      onPanResponderGrant: (event) => {
        if (
          !isMovableCalendarEntry(entry) ||
          armedTimelineEntryIdRef.current !== entry.id
        ) {
          return;
        }

        draggingDayEntryIdRef.current = entry.id;
        dayDragStartRef.current = {
          pageY: event.nativeEvent.pageY,
          startMinutes: getEntryStartMinutes(entry),
        };
        setDraggingDayEntryId(entry.id);
        setDayDragOffsetY(0);
      },
      onPanResponderMove: (event) => {
        if (draggingDayEntryIdRef.current !== entry.id) return;

        setDayDragOffsetY(event.nativeEvent.pageY - dayDragStartRef.current.pageY);
      },
      onPanResponderRelease: async (event) => {
        if (draggingDayEntryIdRef.current !== entry.id) return;

        const dy = event.nativeEvent.pageY - dayDragStartRef.current.pageY;
        const minuteDelta = dy / TIMELINE_MINUTE_HEIGHT;
        const nextMinutes = snapMinutesToStep(
          dayDragStartRef.current.startMinutes + minuteDelta,
        );

        draggingDayEntryIdRef.current = null;
        armedTimelineEntryIdRef.current = null;
        setDraggingDayEntryId(null);
        setArmedTimelineEntryId(null);
        setDayDragOffsetY(0);
        await moveDayEntryToMinutes(entry, nextMinutes);
      },
      onPanResponderTerminate: () => {
        draggingDayEntryIdRef.current = null;
        armedTimelineEntryIdRef.current = null;
        setDraggingDayEntryId(null);
        setArmedTimelineEntryId(null);
        setDayDragOffsetY(0);
      },
    });

    return panResponder.panHandlers;
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
            getLocalDayKey(date) === getLocalDayKey(new Date(entry.printedAt)),
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

  const createWeekTimelinePanHandlers = (entry: CalendarEntry) => {
    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () =>
        isMovableCalendarEntry(entry) &&
        armedTimelineEntryIdRef.current === entry.id,
      onMoveShouldSetPanResponder: (_event, gestureState) =>
        isMovableCalendarEntry(entry) &&
        armedTimelineEntryIdRef.current === entry.id &&
        (Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3),
      onPanResponderGrant: (event) => {
        if (
          !isMovableCalendarEntry(entry) ||
          armedTimelineEntryIdRef.current !== entry.id
        ) {
          return;
        }

        const entryDate = getLocalDayKey(new Date(entry.printedAt));
        const startDayIndex = Math.max(
          0,
          weekDates.findIndex(
            (date) => getLocalDayKey(date) === entryDate,
          ),
        );

        draggingWeekTimelineEntryIdRef.current = entry.id;
        weekTimelineDragStartRef.current = {
          pageX: event.nativeEvent.pageX,
          pageY: event.nativeEvent.pageY,
          startDayIndex,
          startMinutes: getEntryStartMinutes(entry),
        };
        setDraggingWeekTimelineEntryId(entry.id);
        setWeekTimelineDropPreview({
          dayIndex: startDayIndex,
          minutes: getEntryStartMinutes(entry),
        });
        setWeekDragOffset({ x: 0, y: 0 });
      },
      onPanResponderMove: (event) => {
        if (draggingWeekTimelineEntryIdRef.current !== entry.id) return;

        const dx = event.nativeEvent.pageX - weekTimelineDragStartRef.current.pageX;
        const dy = event.nativeEvent.pageY - weekTimelineDragStartRef.current.pageY;

        setWeekDragOffset({ x: dx, y: dy });
        setWeekTimelineDropPreview(getWeekTimelineDropPreview(dx, dy));
      },
      onPanResponderRelease: async (event) => {
        if (draggingWeekTimelineEntryIdRef.current !== entry.id) return;

        const dx = event.nativeEvent.pageX - weekTimelineDragStartRef.current.pageX;
        const dy = event.nativeEvent.pageY - weekTimelineDragStartRef.current.pageY;
        const { dayIndex: targetDayIndex, minutes: nextMinutes } =
          getWeekTimelineDropPreview(dx, dy);

        draggingWeekTimelineEntryIdRef.current = null;
        armedTimelineEntryIdRef.current = null;
        setDraggingWeekTimelineEntryId(null);
        setArmedTimelineEntryId(null);
        setWeekTimelineDropPreview(null);
        setWeekDragOffset({ x: 0, y: 0 });

        const targetDate = weekDates[targetDayIndex];
        if (targetDate) {
          await moveWeekTimelineEntry(entry, targetDate, nextMinutes);
        }
      },
      onPanResponderTerminate: () => {
        draggingWeekTimelineEntryIdRef.current = null;
        armedTimelineEntryIdRef.current = null;
        setDraggingWeekTimelineEntryId(null);
        setArmedTimelineEntryId(null);
        setWeekTimelineDropPreview(null);
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

  const handleTimelineEntryTouchEnd = (entry: CalendarEntry) => {
    const now = Date.now();
    const isDoubleTap =
      timelineLastTapRef.current.id === entry.id &&
      now - timelineLastTapRef.current.timestamp < 320;

    timelineLastTapRef.current = { id: entry.id, timestamp: now };

    if (!isDoubleTap || !isMovableCalendarEntry(entry)) {
      return;
    }

    softHaptic();
    armedTimelineEntryIdRef.current = entry.id;
    setArmedTimelineEntryId(entry.id);
    setDayDragOffsetY(0);
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

  const getEntriesForSelectedDate = () => {
    if (!selectedDate) return [];

    return [...entries, ...projectionEntries]
      .filter((entry) => {
        const entryDate = getLocalDayKey(new Date(entry.printedAt));
        return entryDate === selectedDate;
      })
      .sort((a, b) => {
        const timeA = new Date(a.printedAt).getTime();
        const timeB = new Date(b.printedAt).getTime();
        return timeA - timeB;
      });
  };

  const getEntryStartMinutes = (entry: CalendarEntry) => {
    const segmentStartMinutes = (entry as DisplayCalendarEntry).segmentStartMinutes;
    if (typeof segmentStartMinutes === "number") return segmentStartMinutes;

    const date = new Date(entry.printedAt);
    return date.getHours() * 60 + date.getMinutes();
  };

  const getEntryDurationMinutes = (entry: CalendarEntry) => {
    const segmentDurationMinutes = (entry as DisplayCalendarEntry)
      .segmentDurationMinutes;
    if (typeof segmentDurationMinutes === "number") {
      return segmentDurationMinutes;
    }

    if (entry.timeSpent?.elapsed && entry.timeSpent.elapsed > 0) {
      return entry.timeSpent.elapsed;
    }

    const hours = Number(entry.todo.timer?.hours ?? 0);
    const minutes = Number(entry.todo.timer?.minutes ?? 0);
    const plannedMinutes =
      (Number.isFinite(hours) ? hours : 0) * 60 +
      (Number.isFinite(minutes) ? minutes : 0);

    return plannedMinutes > 0 ? plannedMinutes : 30;
  };

  const getWeekTimelineEntriesForDate = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    return [...entries, ...projectionEntries]
      .flatMap((entry): DisplayCalendarEntry[] => {
        const entryStart = new Date(entry.printedAt);
        const entryEnd = new Date(
          entryStart.getTime() + getEntryDurationMinutes(entry) * 60_000,
        );

        if (
          entryStart.getTime() >= dayEnd.getTime() ||
          entryEnd.getTime() <= dayStart.getTime()
        ) {
          return [];
        }

        const segmentStart = new Date(
          Math.max(entryStart.getTime(), dayStart.getTime()),
        );
        const segmentEnd = new Date(
          Math.min(entryEnd.getTime(), dayEnd.getTime()),
        );
        const segmentStartMinutes =
          segmentStart.getHours() * 60 + segmentStart.getMinutes();
        const segmentDurationMinutes = Math.max(
          1,
          Math.round(
            (segmentEnd.getTime() - segmentStart.getTime()) / 60_000,
          ),
        );

        return [
          {
            ...entry,
            segmentDurationMinutes,
            segmentStartMinutes,
            segmentKey: `${getDisplayEntryKey(entry)}:${getLocalDayKey(date)}`,
          },
        ];
      })
      .sort((a, b) => {
        const timeA = getEntryStartMinutes(a);
        const timeB = getEntryStartMinutes(b);
        return timeA - timeB;
      });
  };

  const getTimelineBounds = (dateEntries: CalendarEntry[]) => {
    if (dateEntries.length === 0) {
      return { startHour: 0, endHour: 24 };
    }

    const firstStart = Math.min(...dateEntries.map(getEntryStartMinutes));
    const lastEnd = Math.max(
      ...dateEntries.map(
        (entry) => getEntryStartMinutes(entry) + getEntryDurationMinutes(entry),
      ),
    );

    return {
      startHour: Math.max(0, Math.floor(firstStart / 60) - 1),
      endHour: Math.min(24, Math.max(Math.ceil(lastEnd / 60) + 1, 1)),
    };
  };

  const getDayTimelineBounds = (dateEntries: CalendarEntry[]) => {
    const bounds = getTimelineBounds(dateEntries);
    if (!isSelectedDateToday()) return bounds;

    const currentMinutes = getCurrentMinutes();
    return {
      startHour: Math.max(0, Math.min(bounds.startHour, Math.floor(currentMinutes / 60) - 1)),
      endHour: Math.min(24, Math.max(bounds.endHour, Math.ceil(currentMinutes / 60) + 1)),
    };
  };

  const getWeekTimelineBounds = (dateEntries: CalendarEntry[]) => {
    const bounds = getTimelineBounds(dateEntries);
    const todayKey = getLocalDayKey(currentTime);
    const weekIncludesToday = weekDates.some(
      (date) => getLocalDayKey(date) === todayKey,
    );
    if (!weekIncludesToday) return bounds;

    const currentMinutes = getCurrentMinutes();
    return {
      startHour: Math.max(
        0,
        Math.min(bounds.startHour, Math.floor(currentMinutes / 60) - 1),
      ),
      endHour: Math.min(
        24,
        Math.max(bounds.endHour, Math.ceil(currentMinutes / 60) + 1),
      ),
    };
  };

  useEffect(() => {
    if (!autoScrollToNow) {
      lastAutoScrollKeyRef.current = null;
      return;
    }

    if (!selectedDate || !isSelectedDateToday()) return;

    const autoScrollKey = getCalendarAutoScrollKey({
      dayTimelineMode,
      selectedDate,
      viewMode,
    });
    if (lastAutoScrollKeyRef.current === autoScrollKey) return;
    lastAutoScrollKeyRef.current = autoScrollKey;

    const dateEntries = getEntriesForSelectedDate();
    if (dateEntries.length === 0) return;

    if (dayTimelineMode) {
      const { startHour } = getDayTimelineBounds(dateEntries);
      scheduleScrollTimelineToCurrentTime(startHour);
      return;
    }

    scrollDayListToCurrentEntry(dateEntries);
  }, [autoScrollToNow, dayTimelineMode, selectedDate, viewMode]);

  useEffect(() => {
    if (!focusedEntryId || !selectedDate) return;

    const dateEntries = getEntriesForSelectedDate();
    const focusedEntry = dateEntries.find((entry) => entry.id === focusedEntryId);
    if (!focusedEntry) return;

    if (dayTimelineMode) {
      const { startHour } = getDayTimelineBounds(dateEntries);
      setTimeout(() => scrollTimelineToEntry(focusedEntry, startHour), 160);
      return;
    }

    scrollDayListToEntry(focusedEntryId);
  }, [dayTimelineMode, entries, focusedEntryId, selectedDate]);

  const getTimelineLayoutItems = (dateEntries: CalendarEntry[]) => {
    const sortedEntries = [...dateEntries].sort((a, b) => {
      const startA = getEntryStartMinutes(a);
      const startB = getEntryStartMinutes(b);
      return startA - startB;
    });
    const activeColumns: Array<{ revealEndX: number; visualEnd: number }> = [];

    return sortedEntries.map((entry) => {
      const startMinutes = getEntryStartMinutes(entry);
      const durationMinutes = getEntryDurationMinutes(entry);
      const label = getTimelineEventLabel(entry, durationMinutes);
      const rawHeight = durationMinutes * TIMELINE_MINUTE_HEIGHT;
      const visualHeight = Math.max(34, rawHeight);
      const visualStart = startMinutes * TIMELINE_MINUTE_HEIGHT;
      const visualEnd = visualStart + visualHeight + 4;
      const overlappingColumns = activeColumns.filter(
        (column) => column.visualEnd > visualStart,
      );
      const offsetX =
        overlappingColumns.length > 0
          ? Math.max(...overlappingColumns.map((column) => column.revealEndX))
          : 0;
      const revealEndX = offsetX + estimateTimelineLabelWidth(label);
      const expiredColumnIndex = activeColumns.findIndex(
        (column) => column.visualEnd <= visualStart,
      );

      if (expiredColumnIndex >= 0) {
        activeColumns[expiredColumnIndex] = { revealEndX, visualEnd };
      } else {
        activeColumns.push({ revealEndX, visualEnd });
      }

      return {
        entry,
        durationMinutes,
        label,
        offsetX,
        startMinutes,
      };
    });
  };

  const getTimelineEventLabel = (
    entry: CalendarEntry,
    durationMinutes: number,
  ) => `${entry.todo.text || "Untitled Note"} · ${durationMinutes}m`;

  const estimateTimelineLabelWidth = (label: string) => {
    const normalizedLength = Array.from(label).reduce((width, character) => {
      return width + (character.charCodeAt(0) > 255 ? 12 : 7);
    }, 0);

    return Math.min(190, Math.max(72, normalizedLength + 22));
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

  const topLevelProjects = projects.filter((project) => !project.parentProjectId);

  const getChildProjects = (projectId: number) =>
    projects.filter((project) => project.parentProjectId === projectId);

  const handleProjectSelect = async (
    entry: CalendarEntry,
    project: Project,
  ) => {
    const childProjects = getChildProjects(project.id);
    if (!project.parentProjectId && childProjects.length > 0) {
      setExpandedProjectParentByEntryId((current) => ({
        ...current,
        [entry.id]:
          entry.todo.projectId === project.id &&
          current[entry.id] === project.id
            ? null
            : project.id,
      }));
    } else if (!project.parentProjectId) {
      setExpandedProjectParentByEntryId((current) => ({
        ...current,
        [entry.id]: null,
      }));
    }

    await handleUpdateEntryTodo(entry, {
      projectId: entry.todo.projectId === project.id ? undefined : project.id,
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
          dateFormat={dateFormat}
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
              detail={
                showProjectPickerForId === entry.id
                  ? undefined
                  : getProjectDisplayLabel(projects, entry.todo.projectId)
              }
            />

            {showProjectPickerForId === entry.id && (
              <View style={styles.projectChips}>
                {topLevelProjects.map((project) => {
                  const isSelected = entry.todo.projectId === project.id;
                  const childProjects = getChildProjects(project.id);
                  const selectedProject = projects.find(
                    (item) => item.id === entry.todo.projectId,
                  );
                  const selectedParentId = selectedProject?.parentProjectId;
                  const isParentExpanded =
                    expandedProjectParentByEntryId[entry.id] === project.id ||
                    selectedParentId === project.id;

                  return (
                    <React.Fragment key={project.id}>
                      <TouchableOpacity
                        onPress={() => handleProjectSelect(entry, project)}
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
                      {isParentExpanded &&
                        childProjects.map((childProject) => {
                          const isChildSelected =
                            entry.todo.projectId === childProject.id;

                          return (
                            <TouchableOpacity
                              key={childProject.id}
                              onPress={() =>
                                handleProjectSelect(entry, childProject)
                              }
                              activeOpacity={0.75}
                              style={[
                                styles.projectChip,
                                styles.subprojectChip,
                                {
                                  backgroundColor: isChildSelected
                                    ? theme.primary
                                    : theme.mode === "light"
                                      ? "#EFF6FF"
                                      : "rgba(96, 165, 250, 0.16)",
                                  borderColor: isChildSelected
                                    ? theme.primary
                                    : theme.mode === "light"
                                      ? theme.border
                                      : "rgba(147, 197, 253, 0.42)",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.projectChipText,
                                  styles.subprojectChipText,
                                  {
                                    color: isChildSelected
                                      ? "#FFFFFF"
                                      : theme.text,
                                  },
                                ]}
                              >
                                {childProject.title || "Untitled"}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                    </React.Fragment>
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
    if (isProjectionEntry(entry)) {
      return (
        <Text
          style={[
            styles.todoText,
            styles.projectedTitle,
            { color: theme.text },
          ]}
          numberOfLines={1}
          onPress={() => handleProjectionPress(entry)}
        >
          {entry.todo.text || "Projected repeat"}
        </Text>
      );
    }

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

    const dateEntries = getEntriesForSelectedDate();

    if (dateEntries.length === 0) {
      return (
        <View style={{ flex: 1 }}>
          <Text style={[styles.placeholder, { color: theme.mutedText }]}>
            No entries for this date
          </Text>
        </View>
      );
    }

    if (dayTimelineMode) {
      return renderDayTimeline(dateEntries);
    }

    return (
      <View style={styles.dayModeToggleSurface}>
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
          {dateEntries.map((entry) => {
            const isProjection = isProjectionEntry(entry);

            return (
            <View
              key={getDisplayEntryKey(entry)}
              ref={(ref) => {
                if (!isProjection) {
                  entryRefByEntryId.current[entry.id] = ref;
                }
              }}
              style={[
                styles.entryContainer,
                isProjection && styles.projectedEntryContainer,
              ]}
            >
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  {renderTodoText(entry)}
                  {!isProjection ? renderTimerInfo(entry) : null}
                </View>
                <View style={styles.headerRight}>
                  {isProjection ? (
                    <Text style={[styles.projectedTime, { color: theme.subtleText }]}>
                      {formatTimelineMinutes(getEntryStartMinutes(entry))}
                    </Text>
                  ) : (
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
                  )}
                </View>
              </View>
              {isProjection ? (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => handleProjectionPress(entry)}
                  style={[
                    styles.projectedNotePreview,
                    {
                      backgroundColor: getNoteBackgroundColor(
                        entry.todo.color,
                        theme,
                      ),
                    },
                  ]}
                >
                  <Text
                    numberOfLines={3}
                    style={[styles.projectedNoteText, { color: theme.text }]}
                  >
                    {entry.todo.note || entry.todo.text || "Projected repeat"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TodoItemNote
                    todo={entry.todo}
                    disableShadow
                    updateNote={(note) => handleUpdateNote(entry.id, note)}
                    onStartEditing={() => {}}
                    onEndEditing={() => setIsNoteBodyDragging(false)}
                    onListDragChange={handleNoteBodyDragChange}
                    onListDragMove={handleNoteBodyDragMove}
                  />
                  {renderSettings(entry)}
                </>
              )}
            </View>
          );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderDayTimeline = (dateEntries: CalendarEntry[]) => {
    const { startHour, endHour } = getDayTimelineBounds(dateEntries);
    const totalHeight = (endHour - startHour) * TIMELINE_HOUR_HEIGHT;
    const layoutItems = getTimelineLayoutItems(dateEntries);
    const hours = Array.from(
      { length: endHour - startHour + 1 },
      (_, index) => startHour + index,
    );

    return (
      <View style={styles.dayModeToggleSurface}>
        <ScrollView
          key={`day-timeline-${selectedDate ?? "none"}`}
          ref={timelineScrollRef}
          style={styles.timelineScroll}
          onContentSizeChange={(_, height) => {
            timelineContentHeightRef.current = height;
            const focusedEntry = focusedEntryId
              ? dateEntries.find((entry) => entry.id === focusedEntryId)
              : null;
            if (focusedEntry) {
              scrollTimelineToEntry(focusedEntry, startHour);
            } else {
              scheduleScrollTimelineToCurrentTime(startHour);
            }
          }}
          onLayout={(event) => {
            timelineViewportHeightRef.current = event.nativeEvent.layout.height;
            const focusedEntry = focusedEntryId
              ? dateEntries.find((entry) => entry.id === focusedEntryId)
              : null;
            if (focusedEntry) {
              scrollTimelineToEntry(focusedEntry, startHour);
            } else {
              scheduleScrollTimelineToCurrentTime(startHour);
            }
          }}
        >
          <View style={[styles.timelineCanvas, { height: totalHeight }]}>
            {hours.map((hour) => {
              const top = (hour - startHour) * TIMELINE_HOUR_HEIGHT;

              return (
                <React.Fragment key={hour}>
                  <Text
                    style={[
                      styles.timelineHourLabel,
                      { color: theme.subtleText, top },
                    ]}
                  >
                    {String(hour).padStart(2, "0")}
                  </Text>
                  <View
                    style={[
                      styles.timelineHourLine,
                      { backgroundColor: theme.border, top },
                    ]}
                  />
                </React.Fragment>
              );
            })}
            {isSelectedDateToday() ? (
              <View
                pointerEvents="none"
                style={[
                  styles.currentTimeRule,
                  {
                    top:
                      (getCurrentMinutes() - startHour * 60) *
                      TIMELINE_MINUTE_HEIGHT,
                  },
                ]}
              >
                <View
                  style={[
                    styles.currentTimeLine,
                    { backgroundColor: theme.primary },
                  ]}
                />
              </View>
            ) : null}
            {layoutItems.map((item) => {
              const { durationMinutes, entry, label, offsetX, startMinutes } =
                item;
              const isProjection = isProjectionEntry(entry);
              const top =
                (startMinutes - startHour * 60) * TIMELINE_MINUTE_HEIGHT;
              const rawHeight = durationMinutes * TIMELINE_MINUTE_HEIGHT;
              const height = Math.max(
                offsetX > 0 ? 38 : 34,
                rawHeight,
              );
              const isCompactEvent = height < 44;
              const eventLaneLeft = TIMELINE_LABEL_WIDTH + 8;
              const cascadeOffset = Math.min(offsetX, 210);

              return (
                <View
                  key={getDisplayEntryKey(entry)}
                  style={[
                    styles.timelineEvent,
                    isProjection && styles.projectedTimelineEvent,
                    isCompactEvent && styles.timelineEventCompact,
                    !isProjection &&
                      !isMovableCalendarEntry(entry) &&
                      styles.timelineEventLocked,
                    draggingDayEntryId === entry.id && {
                      transform: [{ translateY: dayDragOffsetY }],
                      zIndex: 20,
                      elevation: 8,
                    },
                    {
                      top,
                      height,
                      left: eventLaneLeft + cascadeOffset,
                      right: 4,
                      backgroundColor: getNoteBackgroundColor(
                        entry.todo.color,
                        theme,
                      ),
                      borderColor: theme.border,
                    },
                    armedTimelineEntryId === entry.id &&
                      styles.timelineEventArmed,
                  ]}
                  onTouchEnd={() =>
                    isProjection
                      ? handleProjectionPress(entry)
                      : handleTimelineEntryTouchEnd(entry)
                  }
                  {...(isProjection ? {} : createDayTimelinePanHandlers(entry))}
                >
                  {!isProjection && editingTitleId === entry.id ? (
                    <TextInput
                      value={editingText}
                      onChangeText={setEditingText}
                      onBlur={() => handleEndTitleEditing(entry.id)}
                      style={[
                        styles.timelineEventTitle,
                        styles.todoInput,
                        isCompactEvent && styles.timelineEventTitleCompact,
                        { color: theme.text },
                      ]}
                      autoFocus
                    />
                  ) : (
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.timelineEventTitle,
                        isProjection && styles.projectedTimelineEventTitle,
                        isCompactEvent && styles.timelineEventTitleCompact,
                        { color: theme.text },
                      ]}
                      onLongPress={
                        isProjection
                          ? undefined
                          : withLongPressHaptic(() =>
                              handleStartTitleEditing(entry),
                            )
                      }
                    >
                      {label}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderWeekView = () => {
    if (weekTimelineMode) {
      return renderWeekTimeline();
    }

    return (
      <View style={styles.weekContainer}>
        <ScrollView
          style={styles.weekContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.weekRow}>
            {weekDates.map((date) => {
              const dateStr = getLocalDayKey(date);
              const dayEntries = [...entries, ...projectionEntries]
                .filter((entry) => {
                  const entryDate = getLocalDayKey(new Date(entry.printedAt));
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
                      key={getDisplayEntryKey(entry)}
                      onTouchEnd={() =>
                        isProjectionEntry(entry)
                          ? handleProjectionPress(entry)
                          : handleWeekEntryTouchStart(entry)
                      }
                      style={[
                        styles.weekEntryItem,
                        isProjectionEntry(entry) &&
                          styles.projectedWeekEntryItem,
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
                      {...(isProjectionEntry(entry)
                        ? {}
                        : createWeekEntryPanHandlers(entry))}
                    >
                      <View
                        style={[
                          styles.weekEntryContent,
                          isProjectionEntry(entry) &&
                            styles.projectedWeekEntryContent,
                          armedWeekEntryId === entry.id &&
                            styles.weekEntryArmed,
                          draggingWeekEntryId === entry.id &&
                            styles.weekEntryArmed,
                            !isMovableCalendarEntry(entry) &&
                            !isProjectionEntry(entry) &&
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
                              isProjectionEntry(entry) &&
                                styles.projectedWeekEntryText,
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

  const renderWeekTimeline = () => {
    const weekEntries = weekDates.flatMap(getWeekTimelineEntriesForDate);
    const { startHour, endHour } = getWeekTimelineBounds(weekEntries);
    const totalHeight = (endHour - startHour) * TIMELINE_HOUR_HEIGHT;
    const hours = Array.from(
      { length: endHour - startHour + 1 },
      (_, index) => startHour + index,
    );

    return (
      <View style={styles.weekTimelineContainer}>
        <ScrollView style={styles.timelineScroll}>
          <View style={[styles.weekTimelineCanvas, { height: totalHeight }]}>
            {hours.map((hour) => {
              const top = (hour - startHour) * TIMELINE_HOUR_HEIGHT;

              return (
                <Text
                  key={hour}
                  numberOfLines={1}
                  style={[
                    styles.weekTimelineHourLabel,
                    { color: theme.subtleText, top },
                  ]}
                >
                  {String(hour).padStart(2, "0")}
                </Text>
              );
            })}
            {hours.map((hour) => {
              const top = (hour - startHour) * TIMELINE_HOUR_HEIGHT;

              return (
                <View
                  key={`line-${hour}`}
                  style={[
                    styles.weekTimelineHourLine,
                    { backgroundColor: theme.border, top },
                  ]}
                />
              );
            })}
            <View style={styles.weekTimelineColumns}>
              {weekDates.map((date, dayIndex) => {
                const dateStr = getLocalDayKey(date);
                const isTodayColumn = dateStr === getLocalDayKey(currentTime);
                const dayEntries = getWeekTimelineEntriesForDate(date);
                const layoutItems = getTimelineLayoutItems(dayEntries);

                return (
                  <View key={dateStr} style={styles.weekTimelineColumn}>
                    {weekTimelineDropPreview?.dayIndex === dayIndex && (
                      <View
                        pointerEvents="none"
                        style={[
                          styles.weekTimelineDropColumn,
                          {
                            backgroundColor: theme.primary,
                            borderColor: theme.primary,
                          },
                        ]}
                      />
                    )}
                    {isTodayColumn && (
                      <View
                        pointerEvents="none"
                        style={[
                          styles.weekTimelineCurrentTimeRule,
                          {
                            backgroundColor: theme.primary,
                            top:
                              (getCurrentMinutes() - startHour * 60) *
                              TIMELINE_MINUTE_HEIGHT,
                          },
                        ]}
                      />
                    )}
                    {layoutItems.map((item) => {
                      const {
                        durationMinutes,
                        entry,
                        startMinutes,
                      } = item;
                      const isProjection = isProjectionEntry(entry);
                      const top =
                        (startMinutes - startHour * 60) *
                        TIMELINE_MINUTE_HEIGHT;
                      const rawHeight =
                        durationMinutes * TIMELINE_MINUTE_HEIGHT;
                      const height = Math.max(22, rawHeight);
                      const isTinyTimelineEntry = height < 30;
                      const isCompactTimelineEntry = height < 48;
                      const timelineTextLines = isTinyTimelineEntry
                        ? 1
                        : isCompactTimelineEntry
                          ? 2
                          : undefined;

                      return (
                        <View
                          key={getDisplayEntryKey(entry)}
                          style={[
                            styles.weekTimelineEntryItem,
                            isProjection &&
                              styles.projectedWeekTimelineEntryItem,
                            armedTimelineEntryId === entry.id &&
                              styles.weekTimelineEntryArmed,
                            !isProjection &&
                              !isMovableCalendarEntry(entry) &&
                              styles.weekEntryLocked,
                            draggingWeekTimelineEntryId === entry.id && {
                              transform: [
                                { translateX: weekDragOffset.x },
                                { translateY: weekDragOffset.y },
                                { scale: 1.03 },
                              ],
                              zIndex: 20,
                              elevation: 8,
                            },
                            {
                              top,
                              height,
                              left: 0,
                              right: 0,
                            },
                          ]}
                          onTouchEnd={() =>
                            isProjection
                              ? handleProjectionPress(entry)
                              : handleTimelineEntryTouchEnd(entry)
                          }
                          {...(isProjection
                            ? {}
                            : createWeekTimelinePanHandlers(entry))}
                        >
                          <View
                            style={[
                              styles.weekEntryContent,
                              isProjection &&
                                styles.projectedWeekEntryContent,
                              armedTimelineEntryId === entry.id &&
                                styles.weekEntryArmed,
                              {
                                backgroundColor: getNoteBackgroundColor(
                                  entry.todo.color,
                                  theme,
                                ),
                              },
                            ]}
                          >
                            {!isProjection && editingTitleId === entry.id ? (
                              <TextInput
                                value={editingText}
                                onChangeText={setEditingText}
                                onBlur={() => handleEndTitleEditing(entry.id)}
                                style={[
                                  styles.weekEntryText,
                                  isCompactTimelineEntry &&
                                    styles.weekTimelineEntryTextTiny,
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
                                  isProjection &&
                                    styles.projectedWeekEntryText,
                                  isCompactTimelineEntry &&
                                    styles.weekTimelineEntryTextTiny,
                                  { color: theme.text },
                                ]}
                                ellipsizeMode="clip"
                                numberOfLines={timelineTextLines}
                                onLongPress={
                                  isProjection
                                    ? undefined
                                    : withLongPressHaptic(() =>
                                        handleStartTitleEditing(entry),
                                      )
                                }
                              >
                                {entry.todo.text || ""}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
            {weekTimelineDropPreview && (
              <View
                pointerEvents="none"
                style={[
                  styles.weekTimelineDropBadge,
                  {
                    backgroundColor: theme.primary,
                    left:
                      WEEK_TIMELINE_GUTTER_WIDTH +
                      weekTimelineDropPreview.dayIndex * COLUMN_WIDTH +
                      Math.max(2, COLUMN_WIDTH - 44),
                    top: Math.max(
                      0,
                      (weekTimelineDropPreview.minutes - startHour * 60) *
                        TIMELINE_MINUTE_HEIGHT -
                        34,
                    ),
                  },
                ]}
              >
                <Text style={styles.weekTimelineDropBadgeText}>
                  {formatTimelineMinutes(weekTimelineDropPreview.minutes)}
                </Text>
              </View>
            )}
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
  dayModeToggleSurface: {
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
  projectedEntryContainer: {
    opacity: 0.52,
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
  projectedTitle: {
    fontStyle: "italic",
  },
  projectedTime: {
    fontSize: 12,
    fontWeight: "700",
  },
  projectedNotePreview: {
    borderRadius: 4,
    minHeight: 42,
    padding: 10,
  },
  projectedNoteText: {
    fontSize: 14,
    lineHeight: 20,
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
  timelineScroll: {
    flex: 1,
  },
  timelineCanvas: {
    position: "relative",
  },
  timelineHourLabel: {
    fontSize: 10,
    fontWeight: "700",
    left: 0,
    marginTop: -7,
    position: "absolute",
    textAlign: "right",
    width: TIMELINE_LABEL_WIDTH,
  },
  timelineHourLine: {
    height: 1,
    left: TIMELINE_LABEL_WIDTH + 8,
    position: "absolute",
    right: 0,
  },
  currentTimeRule: {
    alignItems: "center",
    flexDirection: "row",
    left: TIMELINE_LABEL_WIDTH + 8,
    position: "absolute",
    right: 0,
    zIndex: 6,
  },
  currentTimeLine: {
    flex: 1,
    height: 1,
    opacity: 0.5,
  },
  timelineEvent: {
    borderRadius: 5,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: "absolute",
  },
  timelineEventCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  timelineEventArmed: {
    borderColor: "#2563eb",
    borderWidth: 2,
  },
  timelineEventLocked: {
    opacity: 0.82,
  },
  projectedTimelineEvent: {
    borderStyle: "dashed",
    opacity: 0.48,
  },
  timelineEventTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  timelineEventTitleCompact: {
    fontSize: 12,
  },
  projectedTimelineEventTitle: {
    fontStyle: "italic",
  },
  timelineEventMeta: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  weekTimelineContainer: {
    flex: 1,
    marginLeft: -WEEK_TIMELINE_GUTTER_WIDTH,
    marginTop: 10,
    overflow: "visible",
  },
  weekTimelineCanvas: {
    marginTop: 1,
    overflow: "visible",
    position: "relative",
  },
  weekTimelineHourLabel: {
    fontSize: 9,
    fontWeight: "700",
    left: 0,
    position: "absolute",
    textAlign: "right",
    transform: [{ rotate: "-90deg" }],
    width: 22,
  },
  weekTimelineHourLine: {
    height: 1,
    left: WEEK_TIMELINE_GUTTER_WIDTH,
    position: "absolute",
    right: 0,
  },
  weekTimelineColumns: {
    bottom: 0,
    flexDirection: "row",
    left: WEEK_TIMELINE_GUTTER_WIDTH,
    position: "absolute",
    right: 0,
    top: 0,
  },
  weekTimelineColumn: {
    flex: 1,
    position: "relative",
  },
  weekTimelineDropColumn: {
    bottom: 0,
    left: 2,
    opacity: 0.055,
    position: "absolute",
    right: 2,
    top: 0,
  },
  weekTimelineCurrentTimeRule: {
    height: 1,
    left: 2,
    opacity: 0.55,
    position: "absolute",
    right: 2,
    zIndex: 7,
  },
  weekTimelineDropBadge: {
    alignItems: "center",
    borderRadius: 10,
    minWidth: 38,
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: "absolute",
    zIndex: 30,
    elevation: 9,
  },
  weekTimelineDropBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  weekTimelineEntryItem: {
    paddingHorizontal: 2,
    position: "absolute",
    width: "100%",
  },
  projectedWeekTimelineEntryItem: {
    opacity: 0.48,
  },
  weekTimelineEntryArmed: {
    transform: [{ scale: 1.03 }],
    zIndex: 12,
    elevation: 5,
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
  projectedWeekEntryContent: {
    borderStyle: "dashed",
    borderWidth: 1,
    opacity: 0.55,
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
  projectedWeekEntryItem: {
    opacity: 0.55,
  },
  projectedWeekEntryText: {
    fontStyle: "italic",
  },
  weekTimelineEntryTextTiny: {
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 11,
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
  subprojectChip: {
    marginLeft: 6,
  },
  subprojectChipText: {
    fontSize: 13,
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
