import React, { memo, useCallback, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTimeManagement } from '../hooks/useTimeManagement';
import TimeWheelPicker from './TimeWheelPicker';
import PlayStopControls from './PlayStopControls';
import { backgroundService } from '../utils/backgroundService';

const TimerView = () => {
  const { hours, minutes, updateTime, isLoaded } = useTimeManagement();
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
      }
    },
    [updateTime, isPlaying],
  );

  const handlePlay = async () => {
    setIsPlaying(true);
    const totalSeconds = parseInt(currentHours) * 3600 + parseInt(currentMinutes) * 60;
    if (totalSeconds > 0) {
      await backgroundService.startTimer(
        currentHours,
        currentMinutes,
        () => {
          setIsPlaying(false);
        },
      );
    }
  };

  const handleStop = async () => {
    setIsPlaying(false);
    await backgroundService.stopTimer();
  };

  if (!isLoaded) {
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