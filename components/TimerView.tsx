import React, { memo, useCallback, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTimeManagement } from '../hooks/useTimeManagement';
import TimeWheelPicker from './TimeWheelPicker';
import PlayStopControls from './PlayStopControls';
import { backgroundService } from '../utils/backgroundService';
import { Todo } from '../types';

interface TimerViewProps {
  selectedTodo: Todo | null;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
}

const TimerView: React.FC<TimerViewProps> = ({ selectedTodo, updateTodo }) => {
  const { hours, minutes, updateTime, isLoaded } = useTimeManagement();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentHours, setCurrentHours] = useState(hours);
  const [currentMinutes, setCurrentMinutes] = useState(minutes);

  useEffect(() => {
    if (selectedTodo?.timer) {
      setCurrentHours(selectedTodo.timer.hours);
      setCurrentMinutes(selectedTodo.timer.minutes);
      setIsPlaying(selectedTodo.timer.isActive);
    } else if (hours && minutes) {
      setCurrentHours(hours);
      setCurrentMinutes(minutes);
    }
  }, [selectedTodo, hours, minutes]);

  useEffect(() => {
    const restoreTimer = async () => {
      if (selectedTodo?.timer?.isActive) {
        const timerState = await backgroundService.restoreTimer();
        if (timerState) {
          setIsPlaying(true);
        }
      }
    };

    restoreTimer();
  }, [selectedTodo]);

  const handleTimeChange = useCallback(
    (h: string, m: string) => {
      if (!isPlaying && selectedTodo) {
        setCurrentHours(h);
        setCurrentMinutes(m);
        updateTime(h, m);
        updateTodo(selectedTodo.id, {
          timer: {
            hours: h,
            minutes: m,
            isActive: false
          }
        });
      }
    },
    [updateTime, isPlaying, selectedTodo, updateTodo],
  );

  const handlePlay = async () => {
    if (!selectedTodo) return;

    setIsPlaying(true);
    const totalSeconds = parseInt(currentHours) * 3600 + parseInt(currentMinutes) * 60;
    
    if (totalSeconds > 0) {
      updateTodo(selectedTodo.id, {
        timer: {
          hours: currentHours,
          minutes: currentMinutes,
          isActive: true,
          endTime: Date.now() + (totalSeconds * 1000)
        }
      });

      await backgroundService.startTimer(
        currentHours,
        currentMinutes,
        () => {
          setIsPlaying(false);
          if (selectedTodo) {
            updateTodo(selectedTodo.id, {
              timer: {
                hours: currentHours,
                minutes: currentMinutes,
                isActive: false
              }
            });
          }
        },
      );
    }
  };

  const handleStop = async () => {
    if (!selectedTodo) return;

    setIsPlaying(false);
    await backgroundService.stopTimer();
    updateTodo(selectedTodo.id, {
      timer: {
        hours: currentHours,
        minutes: currentMinutes,
        isActive: false
      }
    });
  };

  if (!isLoaded || !selectedTodo) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
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
          disabled={parseInt(currentHours) === 0 && parseInt(currentMinutes) === 0}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  controlsContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
});

export default memo(TimerView);