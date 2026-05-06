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
import { Todo } from "../types";
import { addTimerEntryToCalendar } from "../utils/calendarStorage";

const { TimerModule } = NativeModules;
console.log('TimerModule object:', TimerModule);

interface TimerViewProps {
  selectedTodo: Todo | null;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
}

const TimerView: React.FC<TimerViewProps> = ({ selectedTodo, updateTodo }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentHours, setCurrentHours] = useState("00");
  const [currentMinutes, setCurrentMinutes] = useState("25");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [displayTime, setDisplayTime] = useState<string>("");

  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const endTimeRef = useRef<number>(0);
  const hasPrintedRef = useRef(false);

  const formatTimeDisplay = (totalSeconds: number) => {
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

    addTimerEntryToCalendar({
      todo: selectedTodo,
      completed: true,
      startedAt: startTimeRef.current,
      plannedMinutes:
        parseInt(currentHours || "0", 10) * 60 +
        parseInt(currentMinutes || "0", 10),
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
    if (selectedTodo?.timer) {
      setCurrentHours(selectedTodo.timer.hours);
      setCurrentMinutes(selectedTodo.timer.minutes);
      setIsPlaying(false);

      const totalSeconds =
        parseInt(selectedTodo.timer.hours || "0", 10) * 3600 +
        parseInt(selectedTodo.timer.minutes || "0", 10) * 60;

      setRemainingSeconds(totalSeconds);
    } else {
      setCurrentHours("00");
      setCurrentMinutes("25");
      setIsPlaying(false);
      setRemainingSeconds(25 * 60);
    }

    clearTimerInterval();
    hasPrintedRef.current = false;
  }, [selectedTodo?.id]);

  useEffect(() => {
    return () => {
      clearTimerInterval();
    };
  }, []);

  useEffect(() => {
    const emitter = new NativeEventEmitter(TimerModule);

    const subscription = emitter.addListener("TIMER_FINISHED", (event) => {
      if (!selectedTodo) return;

      setIsPlaying(false);
      setRemainingSeconds(0);

      updateTodo(selectedTodo.id, {
        timer: {
          hours: currentHours,
          minutes: currentMinutes,
          isActive: false,
        },
      });

      addTimerEntryToCalendar({
        todo: selectedTodo,
        completed: event.completed,
        startedAt: event.startedAt,
        elapsedSeconds: event.activeElapsedSeconds,
      });
    });

    return () => {
      subscription.remove();
    };
  }, [selectedTodo, currentHours, currentMinutes, updateTodo]);

  const handleTimeChange = useCallback(
    (h: string, m: string) => {
      if (!isPlaying && selectedTodo) {
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
      }
    },
    [isPlaying, selectedTodo, updateTodo],
  );

  const handlePlay = () => {
    if (!selectedTodo || isPlaying) return;

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

console.log('Calling native startTimer', {
  todoId: selectedTodo.id,
  totalSeconds,
  startedAt: startTimeRef.current,
});

    TimerModule.startTimer(selectedTodo.id, totalSeconds, startTimeRef.current);

    timerInterval.current = setInterval(tick, 1000);
  };

  const handleStop = () => {
    if (!selectedTodo || !isPlaying) return;

    clearTimerInterval();

    setIsPlaying(false);

    updateTodo(selectedTodo.id, {
      timer: {
        hours: currentHours,
        minutes: currentMinutes,
        isActive: false,
      },
    });

    TimerModule.stopTimer();

    hasPrintedRef.current = true;
  };

  return (
    <View style={styles.container}>
      <View style={styles.countdownContainer}>
        <Text
          style={[
            styles.countdownText,
            isPlaying && styles.countdownTextActive,
          ]}
        >
          {displayTime || "00:00"}
        </Text>
      </View>

      <TimeWheelPicker
        initialHours={currentHours}
        initialMinutes={currentMinutes}
        onTimeChange={handleTimeChange}
      />

      <View style={styles.controlsContainer}>
        <PlayStopControls
          onPlay={handlePlay}
          onStop={handleStop}
          isPlaying={isPlaying}
          disabled={
            !selectedTodo ||
            (parseInt(currentHours || "0", 10) === 0 &&
              parseInt(currentMinutes || "0", 10) === 0)
          }
        />
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
});

export default memo(TimerView);
