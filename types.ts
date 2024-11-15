export interface RestoredFrom {
  type: 'calendar' | 'archive';
  originalId: number;
  timestamp: string;
}

export interface Todo {
  id: number;
  text: string;
  note: string;
  color: string;
  isEditing: boolean;
  noteType: 'text' | 'bullet' | 'checkbox';
  createdAt?: string;  // ISO timestamp of creation
  restoredFrom?: {
    type: 'calendar' | 'archive';
    originalId: number;
    timestamp: string;
  };
  timer?: {
    hours: string;
    minutes: string;
    isActive: boolean;
  };
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