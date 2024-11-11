import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import TopBar from './components/TopBar';
import Calendar from './components/Calendar';

type ViewType = 'notes' | 'settings' | 'archive' | 'calendar';

const App = () => {
  const [activeView, setActiveView] = useState<ViewType>('notes');
  const [showSettings, setShowSettings] = useState(false);

  const handleAddTodo = () => {
    console.log('Add todo pressed');
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
            {/* Todo list will go here */}
          </View>
          <View style={styles.todoNoteColumnContainer}>
            {/* Todo notes will go here */}
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