import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import TopBar from './components/TopBar';
import Calendar from './components/Calendar';
import TodoList from './components/TodoList';
import { useTodos } from './hooks/useTodos';
import { Todo } from './types';

type ViewType = 'notes' | 'settings' | 'archive' | 'calendar';

const App = () => {
  const [activeView, setActiveView] = useState<ViewType>('notes');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const {
    todos,
    setTodos,
    addTodo,
    updateTodo,
    removeTodo,
  } = useTodos();

  const handleAddTodo = () => {
    const newTodo = addTodo();
    setSelectedTodo(newTodo);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <TopBar
        onAddTodo={handleAddTodo}
        activeView={activeView}
        setActiveView={setActiveView}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
      />
      {activeView === 'calendar' ? (
        <View style={styles.calendarContainer}>
          <Calendar />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.todoListContainer}>
            <TodoList
              todos={todos}
              setTodos={setTodos}
              updateTodo={updateTodo}
              selectedTodo={selectedTodo}
              setSelectedTodo={setSelectedTodo}
            />
          </View>
          <View style={styles.todoNoteColumnContainer}>
            {/* TodoNoteColumn will go here next */}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  todoListContainer: {
    width: '40%',
  },
  todoNoteColumnContainer: {
    width: '60%',
  },
  calendarContainer: {
    flex: 1,
    width: '100%',
  },
});

export default App;