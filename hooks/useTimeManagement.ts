import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TimeState {
  hours: string;
  minutes: string;
}

export const useTimeManagement = () => {
  const [timeState, setTimeState] = useState<TimeState | null>(null);
  const isMounted = useRef(true);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadSavedTime = async () => {
      try {
        const savedTime = await AsyncStorage.getItem('selectedTime');
        if (!isMounted.current) return;

        if (savedTime) {
          setTimeState(JSON.parse(savedTime));
        } else {
          const defaultState = { hours: '00', minutes: '25' };
          setTimeState(defaultState);
          await AsyncStorage.setItem('selectedTime', JSON.stringify(defaultState));
        }
      } catch (error) {
        console.error('Error loading saved time:', error);
      }
    };
    loadSavedTime();

    return () => {
      isMounted.current = false;
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const updateTime = useCallback(async (hours: string, minutes: string) => {
    try {
      const newTimeState = { hours, minutes };
      setTimeState(newTimeState);

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(async () => {
        if (isMounted.current) {
          await AsyncStorage.setItem('selectedTime', JSON.stringify(newTimeState));
        }
      }, 500);
    } catch (error) {
      console.error('Error saving time:', error);
    }
  }, []);

  return {
    hours: timeState?.hours ?? '',
    minutes: timeState?.minutes ?? '',
    isLoaded: timeState !== null,
    updateTime,
  };
};