import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TopBar from './components/TopBar';
import Calendar from './components/Calendar';
import TodoList from './components/TodoList';
import TodoNoteColumn from './components/TodoNoteColumn';
import { Todo, CalendarEntry } from './types';
import { useTodos } from './hooks/useTodos';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

type ViewType = 'notes' | 'settings' | 'archive' | 'calendar';
type CalendarViewMode = 'day' | 'week';

const App = () => {
  const [activeView, setActiveView] = useState<ViewType>('notes');
  const [showSettings, setShowSettings] = useState(false);
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>('day');
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const {
    todos,
    setTodos,
    archivedTodos,
    setArchivedTodos,
    addTodo,
    updateTodo,
    updateArchivedTodo,
    removeTodo,
    archiveTodo,
    unarchiveTodo,
    exportData,
    importData,
  } = useTodos();

  const handleAddTodo = async () => {
    if (activeView === 'calendar') {
      const newTodo: Todo = {
        id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
        text: '',
        note: '',
        color: 'blue',
        isEditing: true,
        noteType: 'text',
        createdAt: new Date().toISOString()
      };
  
      const calendarEntry: CalendarEntry = {
        id: Date.now(),
        todo: newTodo,
        printedAt: `${selectedDate}T${new Date().toTimeString().split(' ')[0]}`
      };
  
      // Update state immediately
      setCalendarEntries(prev => [...prev, calendarEntry]);
  
      // Save to storage in background
      try {
        const savedEntries = await AsyncStorage.getItem('calendarEntries');
        const currentEntries = savedEntries ? JSON.parse(savedEntries) : [];
        const updatedEntries = [...currentEntries, calendarEntry];
        await AsyncStorage.setItem('calendarEntries', JSON.stringify(updatedEntries));
      } catch (error) {
        console.error('Error saving calendar entry:', error);
      }
  
      return calendarEntry;
    } else {
      const newTodo = addTodo();
      setSelectedTodo(newTodo);
      return newTodo;
    }
  };

  const handlePrintOnCalendar = async (todo: Todo) => {
    const calendarEntry: CalendarEntry = {
      id: Date.now(),
      todo: {...todo},
      printedAt: new Date().toISOString()
    };
    
    try {
      const savedEntries = await AsyncStorage.getItem('calendarEntries');
      const currentEntries = savedEntries ? JSON.parse(savedEntries) : [];
      const updatedEntries = [...currentEntries, calendarEntry];
      await AsyncStorage.setItem('calendarEntries', JSON.stringify(updatedEntries));
    } catch (error) {
      console.error('Error saving calendar entry:', error);
    }
  };

  const renderMainContent = () => {
    if (activeView === 'calendar') {
      return (
        <View style={styles.calendarContainer}>
          <Calendar 
            viewMode={calendarViewMode} 
            onDateSelect={setSelectedDate}
            onAddEntry={handleAddTodo}
            entries={calendarEntries}
            setEntries={setCalendarEntries}
            todos={todos}
            setTodos={setTodos} 
            updateTodo={updateTodo} 
          />
        </View>
      );
    }

    return (
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
          <TodoNoteColumn
            selectedTodo={selectedTodo}
            activeView={activeView}
            updateTodo={updateTodo}
            removeTodo={removeTodo}
            archiveTodo={archiveTodo}
            archivedTodos={archivedTodos}
            setArchivedTodos={setArchivedTodos}
            unarchiveTodo={unarchiveTodo}
            updateArchivedTodo={updateArchivedTodo}
            showSettings={showSettings}
            printOnCalendar={handlePrintOnCalendar}
            exportData={exportData}
            importData={importData}
            todos={todos}
            setTodos={setTodos}
          />
        </View>
      </View>
    );
  };

  const handleCalendarPress = () => {
    if (activeView !== 'calendar') {
      setActiveView('calendar');
    } else {
      setCalendarViewMode(prev => prev === 'day' ? 'week' : 'day');
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <TopBar
          onAddTodo={handleAddTodo}
          activeView={activeView}
          setActiveView={setActiveView}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          onCalendarPress={handleCalendarPress}
        />
        {renderMainContent()}
      </SafeAreaView>
    </GestureHandlerRootView>
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