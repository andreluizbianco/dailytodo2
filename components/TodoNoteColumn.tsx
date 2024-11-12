import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import TodoItemNote from './TodoItemNote';
import TodoSettings from './TodoSettings';
import TimerView from './TimerView';
import ArchivedTodos from './ArchivedTodos';
import { Todo } from '../types';

interface TodoNoteColumnProps {
  selectedTodo: Todo | null;
  activeView: 'notes' | 'settings' | 'archive' | 'calendar';
  updateTodo: (id: number, updates: Partial<Todo>) => void;
  removeTodo: (id: number) => void;
  archiveTodo: (id: number) => void;
  archivedTodos: Todo[];
  setArchivedTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  unarchiveTodo: (id: number) => void;
  updateArchivedTodo: (id: number, updates: Partial<Todo>) => void;
  showSettings: boolean;
  printOnCalendar: (todo: Todo) => void;
  exportData: () => void;
  importData: () => void;
}

const TodoNoteColumn: React.FC<TodoNoteColumnProps> = ({
  selectedTodo,
  activeView,
  updateTodo,
  removeTodo,
  archiveTodo,
  archivedTodos,
  setArchivedTodos,
  unarchiveTodo,
  updateArchivedTodo,
  showSettings,
  printOnCalendar,
  exportData,
  importData,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const renderContent = () => {
    if (activeView === 'settings') {
      return <TimerView />;
    }

    if (activeView === 'archive') {
      return (
        <ArchivedTodos
          archivedTodos={archivedTodos}
          setArchivedTodos={setArchivedTodos}
          unarchiveTodo={unarchiveTodo}
          updateArchivedTodo={updateArchivedTodo}
          exportData={exportData}
          importData={importData}
        />
      );
    }

    return (
      selectedTodo && (
        <>
          <TodoItemNote
            todo={selectedTodo}
            updateNote={(noteText: string) => updateTodo(selectedTodo.id, { note: noteText })}
            onStartEditing={() => setIsEditing(true)}
            onEndEditing={() => setIsEditing(false)}
          />
          {activeView === 'notes' && showSettings && (
            <View style={styles.settingsContainer}>
              <TodoSettings
                todo={selectedTodo}
                updateTodo={(updates) => updateTodo(selectedTodo.id, updates)}
                removeTodo={() => removeTodo(selectedTodo.id)}
                archiveTodo={() => archiveTodo(selectedTodo.id)}
                printOnCalendar={printOnCalendar}
              />
            </View>
          )}
        </>
      )
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {renderContent()}
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