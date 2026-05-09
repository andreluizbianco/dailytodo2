import React, { memo, useCallback, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  NativeModules,
  NativeEventEmitter,
} from "react-native";
import TimeWheelPicker from "./TimeWheelPicker";
import PlayStopControls from "./PlayStopControls";
import { TimerMode, Todo } from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { TimerModule } = NativeModules;
console.log("TimerModule object:", TimerModule);

type NativeTimerState = {
  todoId: number;
  startedAt: number;
  lastStartedAt?: number;
  durationSeconds: number;
  remainingSeconds: number;
  activeElapsedSeconds: number;
  isRunning: boolean;
  isPaused: boolean;
  timerMode: TimerMode;
};

interface TimerViewProps {
  selectedTodo: Todo | null;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
}

const TimerView: React.FC<TimerViewProps> = ({ selectedTodo, updateTodo }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerMode, setTimerMode] = useState<TimerMode>("pomodoro");
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [currentHours, setCurrentHours] = useState("00");
  const [currentMinutes, setCurrentMinutes] = useState("25");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [displayTime, setDisplayTime] = useState<string>("");

  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const endTimeRef = useRef<number>(0);
  const hasPrintedRef = useRef(false);
  const stopwatchInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopwatchBaseSecondsRef = useRef(0);
  const stopwatchLastStartedAtRef = useRef(0);
  const clearStopwatchInterval = () => {
    if (stopwatchInterval.current) {
      clearInterval(stopwatchInterval.current);
      stopwatchInterval.current = null;
    }
  };
  const startStopwatchVisualInterval = (
    baseSeconds: number,
    lastStartedAt: number,
  ) => {
    clearStopwatchInterval();

    stopwatchBaseSecondsRef.current = baseSeconds;
    stopwatchLastStartedAtRef.current = lastStartedAt;

    stopwatchInterval.current = setInterval(() => {
      const extraSeconds = Math.floor(
        (Date.now() - stopwatchLastStartedAtRef.current) / 1000,
      );

      setStopwatchSeconds(stopwatchBaseSecondsRef.current + extraSeconds);
    }, 1000);
  };

  const formatTimeDisplay = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const formatStopwatchDisplay = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const clearTimerInterval = () => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
  };

  const persistTimerMode = useCallback(
    (mode: TimerMode) => {
      if (!selectedTodo || selectedTodo.timerMode === mode) return;

      updateTodo(selectedTodo.id, { timerMode: mode });
    },
    [selectedTodo, updateTodo],
  );

  const finishTimer = useCallback(() => {
    if (!selectedTodo || hasPrintedRef.current) return;

    hasPrintedRef.current = true;
    clearTimerInterval();

    setIsPlaying(false);
    setRemainingSeconds(0);

    updateTodo(selectedTodo.id, {
      timer: {
        hours: currentHours,
        minutes: currentMinutes,
        isActive: false,
      },
    });
  }, [selectedTodo, currentHours, currentMinutes, updateTodo]);

  const tick = useCallback(() => {
    const secondsLeft = Math.max(
      0,
      Math.ceil((endTimeRef.current - Date.now()) / 1000),
    );

    setRemainingSeconds(secondsLeft);

    if (secondsLeft <= 0) {
      finishTimer();
    }
  }, [finishTimer]);

  const getSelectedDurationSeconds = useCallback(() => {
    return (
      parseInt(currentHours || "0", 10) * 3600 +
      parseInt(currentMinutes || "0", 10) * 60
    );
  }, [currentHours, currentMinutes]);

  const applyNativeTimerState = useCallback(
    (state: NativeTimerState) => {
      if (!selectedTodo) return;
      if (Number(state.todoId) !== Number(selectedTodo.id)) return;

      clearTimerInterval();
      clearStopwatchInterval();

      const mode = state.timerMode === "stopwatch" ? "stopwatch" : "pomodoro";
      setTimerMode(mode);
      persistTimerMode(mode);
      setIsPaused(state.isPaused);
      setIsPlaying(state.isRunning && !state.isPaused);
      startTimeRef.current = state.startedAt;

      if (!state.isRunning) {
        setIsPaused(false);
        setIsPlaying(false);

        if (mode === "stopwatch") {
          setStopwatchSeconds(0);
        } else {
          setRemainingSeconds(getSelectedDurationSeconds());
        }

        return;
      }

      if (mode === "stopwatch") {
        setStopwatchSeconds(state.activeElapsedSeconds);
        stopwatchBaseSecondsRef.current = state.activeElapsedSeconds;
        stopwatchLastStartedAtRef.current = state.lastStartedAt || Date.now();

        if (!state.isPaused) {
          startStopwatchVisualInterval(
            state.activeElapsedSeconds,
            state.lastStartedAt || Date.now(),
          );
        }

        return;
      }

      setRemainingSeconds(state.remainingSeconds);
      endTimeRef.current = Date.now() + state.remainingSeconds * 1000;

      if (!state.isPaused) {
        timerInterval.current = setInterval(tick, 1000);
      }
    },
    [getSelectedDurationSeconds, persistTimerMode, selectedTodo?.id, tick],
  );

  useEffect(() => {
    setDisplayTime(formatTimeDisplay(remainingSeconds));
  }, [remainingSeconds]);

  useEffect(() => {
    const loadTimerForSelectedTodo = async () => {
      clearTimerInterval();
      clearStopwatchInterval();

      if (!selectedTodo) {
        setCurrentHours("00");
        setCurrentMinutes("25");
        setIsPlaying(false);
        setIsPaused(false);
        setTimerMode("pomodoro");
        setStopwatchSeconds(0);
        setRemainingSeconds(25 * 60);
        return;
      }

      const legacySavedMode = await AsyncStorage.getItem(
        `timerMode:${selectedTodo.id}`,
      );
      const restoredMode =
        selectedTodo.timerMode ??
        (legacySavedMode === "pomodoro" || legacySavedMode === "stopwatch"
          ? legacySavedMode
          : "pomodoro");

      setTimerMode(restoredMode);

      if (!selectedTodo.timerMode) {
        updateTodo(selectedTodo.id, { timerMode: restoredMode });
      }

      try {
        const state = await TimerModule.getTimerState();

        if (
          state?.isRunning &&
          Number(state.todoId) === Number(selectedTodo.id)
        ) {
          setCurrentHours(selectedTodo.timer?.hours ?? "00");
          setCurrentMinutes(selectedTodo.timer?.minutes ?? "25");
          applyNativeTimerState(state);
          return;
        }
      } catch (error) {
        console.log("Error syncing native timer state:", error);
      }

      const hours = selectedTodo.timer?.hours ?? "00";
      const minutes = selectedTodo.timer?.minutes ?? "25";

      setCurrentHours(hours);
      setCurrentMinutes(minutes);
      setIsPlaying(false);
      setIsPaused(false);
      setStopwatchSeconds(0);

      const totalSeconds =
        parseInt(hours || "0", 10) * 3600 + parseInt(minutes || "0", 10) * 60;

      setRemainingSeconds(totalSeconds);
    };

    loadTimerForSelectedTodo();
  }, [applyNativeTimerState, selectedTodo?.id]);

  useEffect(() => {
    return () => {
      clearTimerInterval();
      clearStopwatchInterval();
    };
  }, []);

  useEffect(() => {
    if (!TimerModule) return;

    const emitter = new NativeEventEmitter(TimerModule);

    const sub = emitter.addListener(
      "TIMER_STATE_CHANGED",
      applyNativeTimerState,
    );

    return () => sub.remove();
  }, [applyNativeTimerState]);

  const handleTimeChange = useCallback(
    (h: string, m: string) => {
      if (isPlaying || isPaused || !selectedTodo) return;

      if (h === currentHours && m === currentMinutes) return;

      setCurrentHours(h);
      setCurrentMinutes(m);

      updateTodo(selectedTodo.id, {
        timer: {
          hours: h,
          minutes: m,
          isActive: false,
        },
      });

      const totalSeconds =
        parseInt(h || "0", 10) * 3600 + parseInt(m || "0", 10) * 60;

      setRemainingSeconds(totalSeconds);
    },
    [
      isPlaying,
      isPaused,
      selectedTodo,
      updateTodo,
      currentHours,
      currentMinutes,
    ],
  );

  const handlePlay = async () => {
    if (!selectedTodo) return;

    // If paused, Play means RESUME, not start a new timer.
    if (isPaused) {
      TimerModule.resumeTimer();

      return;
    }

    // If already playing, do nothing.
    if (isPlaying) return;

    const nativeState = await TimerModule.getTimerState();

    if (
      nativeState?.isRunning &&
      Number(nativeState.todoId) !== Number(selectedTodo.id)
    ) {
      TimerModule.stopTimer();

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    if (timerMode === "stopwatch") {
      clearTimerInterval();
      clearStopwatchInterval();

      const now = Date.now();

      startTimeRef.current = now;
      stopwatchBaseSecondsRef.current = 0;
      stopwatchLastStartedAtRef.current = now;

      setStopwatchSeconds(0);
      setIsPlaying(true);
      setIsPaused(false);

      updateTodo(selectedTodo.id, {
        timerMode: "stopwatch",
        timer: {
          hours: currentHours,
          minutes: currentMinutes,
          isActive: true,
        },
      });

      TimerModule.startTimer(
        selectedTodo.id,
        0,
        startTimeRef.current,
        "stopwatch",
        selectedTodo.text || "Untitled",
      );

      startStopwatchVisualInterval(0, now);

      return;
    }

    const totalSeconds = getSelectedDurationSeconds();

    if (totalSeconds <= 0) return;

    clearTimerInterval();

    const now = Date.now();

    startTimeRef.current = now;
    endTimeRef.current = now + totalSeconds * 1000;
    hasPrintedRef.current = false;

    setRemainingSeconds(totalSeconds);
    setIsPlaying(true);
    setIsPaused(false);

    updateTodo(selectedTodo.id, {
      timerMode: "pomodoro",
      timer: {
        hours: currentHours,
        minutes: currentMinutes,
        isActive: true,
      },
    });

    TimerModule.startTimer(
      selectedTodo.id,
      totalSeconds,
      startTimeRef.current,
      "pomodoro",
      selectedTodo.text || "Untitled",
    );

    timerInterval.current = setInterval(tick, 1000);
  };

  const handlePause = () => {
    if (!selectedTodo || !isPlaying) return;

    clearTimerInterval();
    TimerModule.pauseTimer();

    setIsPlaying(false);
    setIsPaused(true);
  };

  const handleStop = () => {
    if (!selectedTodo || (!isPlaying && !isPaused)) return;

    clearTimerInterval();
    clearStopwatchInterval();

    setIsPlaying(false);
    setIsPaused(false);
    setStopwatchSeconds(0);

    updateTodo(selectedTodo.id, {
      timerMode,
      timer: {
        hours: currentHours,
        minutes: currentMinutes,
        isActive: false,
      },
    });

    TimerModule.stopTimer();
  };

  return (
    <View style={styles.container}>
      {timerMode === "pomodoro" ? (
        <TimeWheelPicker
          initialHours={currentHours}
          initialMinutes={currentMinutes}
          onTimeChange={handleTimeChange}
          isPlaying={isPlaying || isPaused}
          displayTime={displayTime || "00:00"}
        />
      ) : (
        <View style={styles.stopwatchContainer}>
          <Text style={styles.stopwatchText}>
            {formatStopwatchDisplay(stopwatchSeconds)}
          </Text>
        </View>
      )}
      <View style={styles.controlsContainer}>
        <PlayStopControls
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          isPlaying={isPlaying}
          isPaused={isPaused}
          disabled={
            !selectedTodo ||
            (timerMode === "pomodoro" &&
              parseInt(currentHours || "0", 10) === 0 &&
              parseInt(currentMinutes || "0", 10) === 0)
          }
        />
      </View>

      <View style={styles.modeSwitch}>
        <Text
          style={[
            styles.modeOption,
            timerMode === "pomodoro" && styles.modeOptionActive,
          ]}
          onPress={async () => {
            if (!isPlaying && !isPaused && selectedTodo) {
              setTimerMode("pomodoro");
              updateTodo(selectedTodo.id, { timerMode: "pomodoro" });
            }
          }}
        >
          Pomodoro
        </Text>

        <Text
          style={[
            styles.modeOption,
            timerMode === "stopwatch" && styles.modeOptionActive,
          ]}
          onPress={async () => {
            if (!isPlaying && !isPaused && selectedTodo) {
              setTimerMode("stopwatch");
              setStopwatchSeconds(0);
              updateTodo(selectedTodo.id, { timerMode: "stopwatch" });
            }
          }}
        >
          Stopwatch
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  countdownContainer: {
    marginBottom: 30,
    padding: 20,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    minWidth: 200,
    alignItems: "center",
  },
  countdownText: {
    fontSize: 48,
    fontWeight: "bold",
    fontVariant: ["tabular-nums"],
    color: "#1f2937",
  },
  countdownTextActive: {
    color: "#2563eb",
  },
  controlsContainer: {
    marginTop: 30,
    alignItems: "center",
  },
  stopwatchContainer: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  stopwatchText: {
    fontSize: 42,
    fontWeight: "700",
    color: "#111827",
    fontVariant: ["tabular-nums"],
  },
  modeSwitch: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    padding: 4,
  },
  modeOption: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  modeOptionActive: {
    backgroundColor: "#FFFFFF",
    color: "#111827",
  },
});

export default memo(TimerView);
