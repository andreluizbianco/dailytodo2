import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Todo } from '../types';
import NoteTypeSelector from './NoteTypeSelector';

const colors: string[] = ['red', 'yellow', 'green', 'blue'];

interface TodoSettingsProps {
    todo: Todo;
    updateTodo: (updates: Partial<Todo>) => void;
    removeTodo: () => void;
    archiveTodo: () => void;
    printOnCalendar: (todo: Todo) => void;
  }
  
  const TodoSettings: React.FC<TodoSettingsProps> = ({
    todo,
    updateTodo,
    removeTodo,
    archiveTodo,
    printOnCalendar
  }) => {
  const [deleteState, setDeleteState] = useState<'initial' | 'confirm'>('initial');
  const [localNoteType, setLocalNoteType] = useState(todo.noteType);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleColorChange = (color: string) => {
    updateTodo({ color });
  };

  const handleDeletePress = () => {
    if (deleteState === 'initial') {
      setDeleteState('confirm');
      timeoutRef.current = setTimeout(() => setDeleteState('initial'), 3000);
    }
  };

  const handleDeleteLongPress = () => {
    if (deleteState === 'confirm') {
      removeTodo();
      setDeleteState('initial');
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };

  const handleNoteTypeSelect = (type: 'text' | 'bullet' | 'checkbox') => {
    setLocalNoteType(type);
    updateTodo({ noteType: type });
  };

  return (
    <View style={styles.container}>
      <View style={styles.colorPalette}>
        {colors.map(color => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorButton,
              { backgroundColor: getColorValue(color) },
              todo.color === color && styles.selectedColor,
            ]}
            onPress={() => handleColorChange(color)}
          />
        ))}
      </View>

      <NoteTypeSelector
        selectedType={localNoteType}
        onSelectType={handleNoteTypeSelect}
      />

    <TouchableOpacity 
    style={styles.button} 
    onPress={() => printOnCalendar(todo)}
    >
    <Text style={styles.buttonText}>Print on Calendar</Text>
    </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={archiveTodo}>
        <Text style={styles.buttonText}>Archive Todo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDeletePress}
        onLongPress={handleDeleteLongPress}
        delayLongPress={1000}
      >
        <Text style={styles.buttonText}>
          {deleteState === 'initial' ? 'Delete Todo' : 'Long press to confirm delete'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const getColorValue = (color: string): string => {
  switch (color) {
    case 'red':
      return '#ff6b6b';
    case 'yellow':
      return '#ffd93d';
    case 'green':
      return '#6bcb77';
    case 'blue':
      return '#4d96ff';
    default:
      return '#4d96ff';
  }
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  colorPalette: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
    marginTop: 10,
  },
  colorButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  selectedColor: {
    borderWidth: 2,
    borderColor: '#4b5563',
  },
  button: {
    backgroundColor: '#4b5563',
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default TodoSettings;