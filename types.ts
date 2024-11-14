export interface Todo {
  id: number;
  text: string;
  note: string;
  color: string;
  isEditing: boolean;
  noteType: 'text' | 'bullet' | 'checkbox';
  timer?: {
    hours: string;
    minutes: string;
    isActive: boolean;
    endTime?: number;
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