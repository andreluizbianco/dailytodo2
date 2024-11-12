export interface Todo {
    id: number;
    text: string;
    note: string;
    color: string;
    isEditing: boolean;
    noteType: 'text' | 'bullet' | 'checkbox';
  }
  
  export interface CalendarEntry {
    id: number;
    todo: Todo;
    printedAt: string;
  }