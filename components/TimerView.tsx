import React, { memo, useCallback, useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useTimeManagement } from '../hooks/useTimeManagement';
import TimeWheelPicker from './TimeWheelPicker';
import PlayStopControls from './PlayStopControls';
import { backgroundService } from '../utils/backgroundService';

const formatTimeLeft = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hours > 0) {
    parts.push(hours.toString().padStart(2, '0'));
  }
  parts.push(minutes.toString().padStart(2, '0'));
  parts.push(secs.toString().padStart(2, '0'));

  return parts.join(':');
};

const TimerView = () => {
  const { hours, minutes, updateTime, isLoaded } = useTimeManagement();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentHours, setCurrentHours] = useState(hours);
  const [currentMinutes, setCurrentMinutes] = useState(minutes);

  useEffect(() => {
    if (hours && minutes) {
      setCurrentHours(hours);
      setCurrentMinutes(minutes);
    }
  }, [hours, minutes]);

  useEffect(() => {
    const restoreTimer = async () => {
      const timerState = await backgroundService.restoreTimer();
      if (timerState) {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((timerState.endTime - now) / 1000));
        setTimeLeft(remaining);
        setIsPlaying(true);
      }
    };

    restoreTimer();
  }, []);

  const handleTimeChange = useCallback(
    (h: string, m: string) => {
      if (!isPlaying) {
        setCurrentHours(h);
        setCurrentMinutes(m);
        updateTime(h, m);
        const totalSeconds = parseInt(h) * 3600 + parseInt(m) * 60;
        setTimeLeft(totalSeconds);
      }
    },
    [updateTime, isPlaying],
  );

  const handlePlay = async () => {
    setIsPlaying(true);
    if (timeLeft > 0) {
      await backgroundService.startTimer(
        currentHours,
        currentMinutes,
        () => {
          setIsPlaying(false);
          setTimeLeft(0);
        },
      );
    }
  };

  const handleStop = async () => {
    setIsPlaying(false);
    await backgroundService.stopTimer();
    
    if (currentHours && currentMinutes) {
      const totalSeconds = parseInt(currentHours) * 3600 + parseInt(currentMinutes) * 60;
      setTimeLeft(totalSeconds);
    }
  };

  if (!isLoaded) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {!isPlaying ? (
        <TimeWheelPicker
          initialHours={currentHours}
          initialMinutes={currentMinutes}
          onTimeChange={handleTimeChange}
        />
      ) : (
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownText}>{formatTimeLeft(timeLeft)}</Text>
        </View>
      )}
      <View style={styles.controlsContainer}>
        <PlayStopControls
          onPlay={handlePlay}
          onStop={handleStop}
          isPlaying={isPlaying}
          disabled={timeLeft === 0}
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
  countdownContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1f2937',
  },
});

export default memo(TimerView);