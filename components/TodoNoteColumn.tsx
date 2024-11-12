import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import TodoItemNote from './TodoItemNote';
import TodoSettings from './TodoSettings';
import { Todo } from '../types';

interface TodoNoteColumnProps {
    selectedTodo: Todo | null;
    activeView: 'notes' | 'settings' | 'archive' | 'calendar';
    updateTodo: (id: number, updates: Partial<Todo>) => void;
    removeTodo: (id: number) => void;
    archiveTodo: (id: number) => void;
    showSettings: boolean;
    printOnCalendar: (todo: Todo) => void;
  }
  
  const TodoNoteColumn: React.FC<TodoNoteColumnProps> = ({
    selectedTodo,
    activeView,
    updateTodo,
    removeTodo,
    archiveTodo,
    showSettings,
    printOnCalendar
  }) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleUpdateTodo = (updates: Partial<Todo>) => {
    if (selectedTodo) {
      updateTodo(selectedTodo.id, updates);
    }
  };

  const handleRemoveTodo = () => {
    if (selectedTodo) {
      removeTodo(selectedTodo.id);
    }
  };

  const handleArchiveTodo = () => {
    if (selectedTodo) {
      archiveTodo(selectedTodo.id);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {selectedTodo && (
          <>
            <TodoItemNote
              todo={selectedTodo}
              updateNote={(noteText: string) => handleUpdateTodo({ note: noteText })}
              onStartEditing={() => setIsEditing(true)}
              onEndEditing={() => setIsEditing(false)}
            />
            {activeView === 'notes' && showSettings && (
              <View style={styles.settingsContainer}>
                <TodoSettings
                  todo={selectedTodo}
                  updateTodo={handleUpdateTodo}
                  removeTodo={handleRemoveTodo}
                  archiveTodo={handleArchiveTodo}
                  printOnCalendar={printOnCalendar}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  scrollView: {
    flex: 1,
  },
  settingsContainer: {
    marginTop: 8,
    paddingTop: 12,
  },
});

export default TodoNoteColumn;