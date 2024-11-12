import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TIMER_TASK = 'TIMER_TASK';
const TIMER_NOTIFICATION_ID = 'timer-notification';
const TIMER_COMPLETE_NOTIFICATION_ID = 'timer-complete';

interface TimerState {
  endTime: number;
  hours: string;
  minutes: string;
  isActive: boolean;
}

class BackgroundService {
  private static instance: BackgroundService;
  private timerState: TimerState | null = null;
  private hasTriggered: boolean = false;

  private constructor() {
    this.initNotifications();
    this.registerBackgroundTask();
  }

  static getInstance(): BackgroundService {
    if (!BackgroundService.instance) {
      BackgroundService.instance = new BackgroundService();
    }
    return BackgroundService.instance;
  }

  private async initNotifications() {
    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    await Notifications.requestPermissionsAsync();
  }

  private formatCountdown(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private async registerBackgroundTask() {
    TaskManager.defineTask(TIMER_TASK, async () => {
      const timerState = await this.getTimerState();
      if (!timerState || !timerState.isActive) return BackgroundFetch.BackgroundFetchResult.NoData;

      const now = Date.now();
      const remaining = Math.max(0, timerState.endTime - now);

      if (remaining > 0) {
        await this.updateNotification(remaining);
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } else if (!this.hasTriggered) {
        this.hasTriggered = true;
        await this.triggerAlarm();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }

      return BackgroundFetch.BackgroundFetchResult.NoData;
    });

    try {
      await BackgroundFetch.registerTaskAsync(TIMER_TASK, {
        minimumInterval: 1,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (err) {
      console.log("Task Register failed:", err);
    }
  }

  private async updateNotification(remainingMilliseconds: number) {
    const timeString = this.formatCountdown(remainingMilliseconds);
    const totalMs = (parseInt(this.timerState?.hours || '0') * 3600 + parseInt(this.timerState?.minutes || '0') * 60) * 1000;
    const progress = Math.round((remainingMilliseconds / totalMs) * 100);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏱️ Timer Running',
        body: `${timeString} remaining (${progress}%)`,
        data: { type: 'timer-update' },
      },
      identifier: TIMER_NOTIFICATION_ID,
      trigger: null,
    });
  }

  private async triggerAlarm() {
    // Cancel the progress notification
    await Notifications.cancelScheduledNotificationAsync(TIMER_NOTIFICATION_ID);

    // Show completion notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Timer Complete!',
        body: 'Your timer has finished',
        sound: true,
        data: { type: 'timer-complete' },
      },
      identifier: TIMER_COMPLETE_NOTIFICATION_ID,
      trigger: null,
    });

    await this.stopTimer();
  }

  private async getTimerState(): Promise<TimerState | null> {
    try {
      const state = await AsyncStorage.getItem('timerState');
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('Error getting timer state:', error);
      return null;
    }
  }

  async startTimer(
    hours: string,
    minutes: string,
    onTimerComplete: () => void
  ) {
    const totalMilliseconds =
      (parseInt(hours) * 3600 + parseInt(minutes) * 60) * 1000;
    const endTime = Date.now() + totalMilliseconds;
    this.hasTriggered = false;

    this.timerState = {
      endTime,
      hours,
      minutes,
      isActive: true,
    };

    await AsyncStorage.setItem('timerState', JSON.stringify(this.timerState));
    await this.updateNotification(totalMilliseconds);

    try {
      await BackgroundFetch.registerTaskAsync(TIMER_TASK, {
        minimumInterval: 1,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (err) {
      console.log("Error starting background task:", err);
    }
  }

  async stopTimer() {
    this.timerState = null;
    this.hasTriggered = false;

    await AsyncStorage.removeItem('timerState');
    await Notifications.cancelScheduledNotificationAsync(TIMER_NOTIFICATION_ID);
    await Notifications.cancelScheduledNotificationAsync(TIMER_COMPLETE_NOTIFICATION_ID);

    try {
      await BackgroundFetch.unregisterTaskAsync(TIMER_TASK);
    } catch (err) {
      console.log("Error stopping background task:", err);
    }
  }

  async restoreTimer(): Promise<TimerState | null> {
    const savedState = await this.getTimerState();
    if (savedState?.isActive && Date.now() < savedState.endTime) {
      this.timerState = savedState;
      return savedState;
    }
    return null;
  }
}

export const backgroundService = BackgroundService.getInstance();