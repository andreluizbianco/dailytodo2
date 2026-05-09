import React, { memo, useCallback, useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, NativeModules } from "react-native";
import TimeWheelPicker from "./TimeWheelPicker";
import PlayStopControls from "./PlayStopControls";
import { Todo } from "../types";
import { addTimerEntryToCalendar } from "../utils/calendarStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { TimerModule } = NativeModules;
console.log("TimerModule object:", TimerModule);

interface TimerViewProps {
  selectedTodo: Todo | null;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
}

const TimerView: React.FC<TimerViewProps> = ({ selectedTodo, updateTodo }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerMode, setTimerMode] = useState<"pomodoro" | "stopwatch">(
    "pomodoro",
  );
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
  const clearStopwatchInterval = () => {
    if (stopwatchInterval.current) {
      clearInterval(stopwatchInterval.current);
      stopwatchInterval.current = null;
    }
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

      const savedMode = await AsyncStorage.getItem(
        `timerMode:${selectedTodo.id}`,
      );

      if (savedMode === "pomodoro" || savedMode === "stopwatch") {
        setTimerMode(savedMode);
      }

      try {
        const state = await TimerModule.getTimerState();

        if (
          state?.isRunning &&
          Number(state.todoId) === Number(selectedTodo.id)
        ) {
          const mode =
            state.timerMode === "stopwatch" ? "stopwatch" : "pomodoro";

          setTimerMode(mode);
          setCurrentHours(selectedTodo.timer?.hours ?? "00");
          setCurrentMinutes(selectedTodo.timer?.minutes ?? "25");
          setIsPlaying(!state.isPaused);
          setIsPaused(state.isPaused);
          startTimeRef.current = state.startedAt;

          if (mode === "stopwatch") {
            const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);

            setStopwatchSeconds(elapsed);

            if (!state.isPaused) {
              stopwatchInterval.current = setInterval(() => {
                setStopwatchSeconds(
                  Math.floor((Date.now() - state.startedAt) / 1000),
                );
              }, 1000);
            }

            return;
          }

          setRemainingSeconds(state.remainingSeconds);
          endTimeRef.current = Date.now() + state.remainingSeconds * 1000;

          if (!state.isPaused) {
            timerInterval.current = setInterval(tick, 1000);
          }

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
  }, [selectedTodo?.id]);

  useEffect(() => {
    return () => {
      clearTimerInterval();
      clearStopwatchInterval();
    };
  }, []);

  const handleTimeChange = useCallback(
    (h: string, m: string) => {
      if (isPlaying || !selectedTodo) return;

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
    [isPlaying, selectedTodo, updateTodo, currentHours, currentMinutes],
  );

  const handlePlay = async () => {
    if (!selectedTodo || isPlaying) return;

    if (timerMode === "stopwatch") {
      clearTimerInterval();
      clearStopwatchInterval();

      const now = Date.now();

      startTimeRef.current = now;
      setStopwatchSeconds(0);
      setIsPlaying(true);
      setIsPaused(false);

      TimerModule.startTimer(
        selectedTodo.id,
        24 * 60 * 60,
        startTimeRef.current,
        "stopwatch",
        selectedTodo.text || "Untitled",
      );

      stopwatchInterval.current = setInterval(() => {
        setStopwatchSeconds(
          Math.floor((Date.now() - startTimeRef.current) / 1000),
        );
      }, 1000);

      return;
    }

    if (isPaused) {
      TimerModule.resumeTimer();

      setIsPaused(false);
      setIsPlaying(true);
      endTimeRef.current = Date.now() + remainingSeconds * 1000;
      timerInterval.current = setInterval(tick, 1000);

      return;
    }

    const nativeState = await TimerModule.getTimerState();

    if (
      nativeState?.isRunning &&
      Number(nativeState.todoId) !== Number(selectedTodo.id)
    ) {
      TimerModule.stopTimer();

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    const totalSeconds =
      parseInt(currentHours || "0", 10) * 3600 +
      parseInt(currentMinutes || "0", 10) * 60;

    if (totalSeconds <= 0) return;

    clearTimerInterval();

    const now = Date.now();

    startTimeRef.current = now;
    endTimeRef.current = now + totalSeconds * 1000;
    hasPrintedRef.current = false;

    setRemainingSeconds(totalSeconds);
    setIsPlaying(true);

    updateTodo(selectedTodo.id, {
      timer: {
        hours: currentHours,
        minutes: currentMinutes,
        isActive: true,
      },
    });

    console.log("Calling native startTimer", {
      todoId: selectedTodo.id,
      totalSeconds,
      startedAt: startTimeRef.current,
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
          isPlaying={isPlaying}
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
              await AsyncStorage.setItem(
                `timerMode:${selectedTodo.id}`,
                "pomodoro",
              );
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
              await AsyncStorage.setItem(
                `timerMode:${selectedTodo.id}`,
                "stopwatch",
              );
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
