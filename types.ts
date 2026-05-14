export interface RestoredFrom {
  type: "calendar" | "archive";
  originalId: number;
  timestamp: string;
}

export type TimerMode = "pomodoro" | "stopwatch";
export type ScheduleMode = "every" | "in" | "date";
export type ScheduleUnit = "days" | "weeks" | "months" | "years";
export type ReminderUnit = "minutes" | "hours" | "days";
export type TrashRetention = "3d" | "7d" | "30d" | "never";

export interface TodoSchedule {
  mode: ScheduleMode;
  amount: number;
  unit: ScheduleUnit;
  weekdays?: number[];
  time?: string;
  startsAt?: string;
  targetDate?: string;
  nextAt?: string;
}

export interface TodoReminder {
  amount: number;
  unit: ReminderUnit;
  notificationId?: string;
}

export interface Project {
  id: number;
  title: string;
  note: string;
  color: string;
  isEditing: boolean;
  createdAt?: string;
}

export interface Todo {
  id: number;
  text: string;
  note: string;
  color: string;
  isEditing: boolean;
  noteType: "text" | "bullet" | "checkbox";
  createdAt?: string; // ISO timestamp of creation
  restoredFrom?: {
    type: "calendar" | "archive";
    originalId: number;
    timestamp: string;
  };
  timerMode?: TimerMode;
  timer?: {
    hours: string;
    minutes: string;
    isActive: boolean;
  };
  schedule?: TodoSchedule;
  reminder?: TodoReminder;
  projectId?: number;
}

export interface TrashedTodo extends Todo {
  deletedAt: string;
}

export interface CalendarEntry {
  id: number;
  todo: Todo;
  printedAt: string;
  timeSpent?: {
    elapsed: number; // Total time in minutes
  };
  timerCompleted?: boolean;
}
