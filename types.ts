export interface RestoredFrom {
  type: "calendar" | "archive";
  originalId: number;
  timestamp: string;
}

export type TimerMode = "pomodoro" | "stopwatch";
export type AmbientSoundId = "waterfall" | "cafe" | "stream";
export type ScheduleMode = "every" | "in" | "date";
export type ScheduleUnit = "days" | "weeks" | "months" | "years";
export type ReminderUnit = "minutes" | "hours" | "days";
export type TrashRetention = "3d" | "7d" | "30d" | "never";
export type CalendarProjectionRange = "off" | "1w" | "3m" | "6m";
export type DateFormatPreference = "dmy" | "mdy" | "ymd";
export type PhotoScanFormat = "lines" | "paragraph" | "compact";
export type VoiceLanguagePreference =
  | "system"
  | "pt-PT"
  | "pt-BR"
  | "en-US"
  | "en-GB"
  | "de-DE"
  | "fr-FR"
  | "es-ES"
  | "it-IT";

export interface NotePhotoAttachment {
  id: string;
  type: "image";
  uri: string;
  name?: string;
  createdAt: string;
  ocrText?: string;
}

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
  parentProjectId?: number;
  title: string;
  note: string;
  color: string;
  isEditing: boolean;
  createdAt?: string;
  timerMode?: TimerMode;
  timer?: {
    hours: string;
    minutes: string;
    isActive: boolean;
  };
  ambientSound?: {
    enabled: boolean;
    soundId: AmbientSoundId;
  };
}

export interface Todo {
  id: number;
  text: string;
  note: string;
  color: string;
  isEditing: boolean;
  noteType: "text" | "bullet" | "checkbox";
  checkboxBehavior?: "simple" | "completion";
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
  ambientSound?: {
    enabled: boolean;
    soundId: AmbientSoundId;
  };
  schedule?: TodoSchedule;
  reminder?: TodoReminder;
  projectId?: number;
  attachments?: NotePhotoAttachment[];
}

export interface TrashedTodo extends Todo {
  deletedAt: string;
}

export interface CalendarEntry {
  id: number;
  todo: Todo;
  printedAt: string;
  showInDaily?: boolean;
  timeSpent?: {
    elapsed: number; // Total time in minutes
  };
  timerCompleted?: boolean;
  isTrackingEntry?: boolean;
}

export type TodayTodoSource =
  | { type: "active"; todoId: number }
  | { type: "archived-repeat"; todoId: number }
  | { type: "calendar-instance"; entryId: number; todoId: number };

export interface TodayTodoItem {
  todo: Todo;
  source: TodayTodoSource;
  occurrenceKey: string;
  sortTimeMinutes?: number;
}
