import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import TimeWheelPicker from './TimeWheelPicker';
import PlayStopControls from './PlayStopControls';
import { Todo } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TimerViewProps {
  selectedTodo: Todo | null;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
}

const TimerView: React.FC<TimerViewProps> = ({ selectedTodo, updateTodo }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentHours, setCurrentHours] = useState('00');
  const [currentMinutes, setCurrentMinutes] = useState('25');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [displayTime, setDisplayTime] = useState<string>('');
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Print todo to calendar with correct elapsed time
  const printToCalendar = async (todo: Todo, completed: boolean) => {
    const now = Date.now();
    const elapsedMs = now - startTimeRef.current;
    const elapsedMinutes = Math.max(1, Math.floor(elapsedMs / (1000 * 60)));
    
    // Ensure we have the latest todo data from storage before printing
    try {
      const savedData = await AsyncStorage.getItem('todosData');
      let currentTodo = todo;
      
      if (savedData) {
        const { todos } = JSON.parse(savedData);
        // Find the latest version of this todo
        const latestTodo = todos.find((t: Todo) => t.id === todo.id);
        if (latestTodo) {
          currentTodo = latestTodo;
        }
      }
      
      const calendarEntry = {
        id: now,
        todo: { ...currentTodo },  // Use the latest todo data
        printedAt: new Date().toISOString(),
        timerCompleted: completed,
        timeSpent: {
          elapsed: elapsedMinutes
        }
      };
      
      try {
        const savedEntries = await AsyncStorage.getItem('calendarEntries');
        const currentEntries = savedEntries ? JSON.parse(savedEntries) : [];
        const updatedEntries = [...currentEntries, calendarEntry];
        await AsyncStorage.setItem('calendarEntries', JSON.stringify(updatedEntries));
      } catch (error) {
        console.error('Error saving calendar entry:', error);
      }
    } catch (error) {
      console.error('Error retrieving latest todo data:', error);
    }
  };
  
  // Load saved timer settings when todo changes
  useEffect(() => {
    if (selectedTodo?.timer) {
      setCurrentHours(selectedTodo.timer.hours);
      setCurrentMinutes(selectedTodo.timer.minutes);
      setIsPlaying(selectedTodo.timer.isActive || false);
      
      if (selectedTodo.timer.isActive) {
        handlePlay();
      }
    } else {
      setCurrentHours('00');
      setCurrentMinutes('25');
      setIsPlaying(false);
    }
  }, [selectedTodo?.id]);

  const formatTimeDisplay = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (remainingSeconds >= 0) {
      setDisplayTime(formatTimeDisplay(remainingSeconds));
    }
  }, [remainingSeconds]);

  useEffect(() => {
    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, []);

  const handleTimeChange = useCallback(
    (h: string, m: string) => {
      if (!isPlaying && selectedTodo) {
        setCurrentHours(h);
        setCurrentMinutes(m);
        updateTodo(selectedTodo.id, {
          timer: {
            hours: h,
            minutes: m,
            isActive: false
          }
        });
        
        const totalSeconds = (parseInt(h) * 3600) + (parseInt(m) * 60);
        setRemainingSeconds(totalSeconds);
      }
    },
    [isPlaying, selectedTodo, updateTodo],
  );

  const handlePlay = () => {
    if (!selectedTodo) return;

    const totalSeconds = 
      (parseInt(currentHours) * 3600) + 
      (parseInt(currentMinutes) * 60);
    
    if (totalSeconds > 0) {
      startTimeRef.current = Date.now(); // Record start time
      setRemainingSeconds(totalSeconds);
      setIsPlaying(true);
      updateTodo(selectedTodo.id, {
        timer: {
          hours: currentHours,
          minutes: currentMinutes,
          isActive: true
        }
      });

      timerInterval.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            // Timer completed
            clearInterval(timerInterval.current!);
            setIsPlaying(false);
            updateTodo(selectedTodo.id, {
              timer: {
                hours: currentHours,
                minutes: currentMinutes,
                isActive: false
              }
            });
            // Print to calendar when timer completes
            if (selectedTodo) {
              printToCalendar(selectedTodo, true);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const handleStop = () => {
    if (!selectedTodo) return;

    if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }
    
    setIsPlaying(false);
    updateTodo(selectedTodo.id, {
      timer: {
        hours: currentHours,
        minutes: currentMinutes,
        isActive: false
      }
    });

    // Print to calendar with actual elapsed time when stopped
    printToCalendar(selectedTodo, false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.countdownContainer}>
        <Text style={[
          styles.countdownText,
          isPlaying && styles.countdownTextActive
        ]}>
          {displayTime || '00:00'}
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
          disabled={!selectedTodo || (parseInt(currentHours) === 0 && parseInt(currentMinutes) === 0)}
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
  countdownContainer: {
    marginBottom: 30,
    padding: 20,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    minWidth: 200,
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 48,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    color: '#1f2937',
  },
  countdownTextActive: {
    color: '#2563eb',
  },
  controlsContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
});

export default memo(TimerView);