import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TodoItemNote from './TodoItemNote';
import { CalendarEntry, Todo } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 40) / 7;

interface CalendarEntriesProps {
  selectedDate: string | null;
  entries: CalendarEntry[];
  setEntries: React.Dispatch<React.SetStateAction<CalendarEntry[]>>;
  viewMode: 'week' | 'day';
  weekDates: Date[];
  onAddEntry: () => Promise<Todo | CalendarEntry | undefined>;
}

const CalendarEntries: React.FC<CalendarEntriesProps> = ({
  selectedDate,
  entries,
  setEntries,
  viewMode,
  weekDates,
  onAddEntry
}) => {
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showSettingsForId, setShowSettingsForId] = useState<number | null>(null);

  const formatElapsedTime = (elapsedMinutes: number): string => {
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;
    
    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const handleUpdateNote = async (entryId: number, newNote: string) => {
    const updatedEntries = entries.map(entry => 
      entry.id === entryId ? {
        ...entry,
        todo: { ...entry.todo, note: newNote }
      } : entry
    );

    setEntries(updatedEntries);
    await AsyncStorage.setItem('calendarEntries', JSON.stringify(updatedEntries));
  };

  const handleStartTitleEditing = (entry: CalendarEntry) => {
    setEditingTitleId(entry.id);
    setEditingText(entry.todo.text);
  };

  const handleEndTitleEditing = async (entryId: number) => {
    const updatedEntries = entries.map(entry =>
      entry.id === entryId ? {
        ...entry,
        todo: { ...entry.todo, text: editingText }
      } : entry
    );

    setEntries(updatedEntries);
    setEditingTitleId(null);
    await AsyncStorage.setItem('calendarEntries', JSON.stringify(updatedEntries));
  };

  const handleDeleteEntry = async (entryId: number) => {
    const updatedEntries = entries.filter(entry => entry.id !== entryId);
    setEntries(updatedEntries);
    await AsyncStorage.setItem('calendarEntries', JSON.stringify(updatedEntries));
  };

  const handleTitlePress = (entryId: number) => {
    setShowSettingsForId(showSettingsForId === entryId ? null : entryId);
  };

  const getColorValue = (buttonColor: string): string => {
    switch (buttonColor) {
      case '#ff6b6b':
        return 'red';
      case '#ffd93d':
        return 'yellow';
      case '#6bcb77':
        return 'green';
      case '#4d96ff':
        return 'blue';
      default:
        return 'blue';
    }
  };
  
  const handleColorChange = async (entryId: number, buttonColor: string) => {
    const color = getColorValue(buttonColor);
    
    const updatedEntries = entries.map(entry =>
      entry.id === entryId ? {
        ...entry,
        todo: { ...entry.todo, color }
      } : entry
    );
  
    setEntries(updatedEntries);
    await AsyncStorage.setItem('calendarEntries', JSON.stringify(updatedEntries));
  };

  const renderSettings = (entry: CalendarEntry) => {
    if (showSettingsForId !== entry.id) return null;
  
    return (
      <View style={styles.settingsContainer}>
        <View style={styles.colorPalette}>
          <TouchableOpacity 
            style={[
              styles.colorButton, 
              { backgroundColor: '#ff6b6b' },
              entry.todo.color === 'red' && styles.selectedColor
            ]}
            onPress={() => handleColorChange(entry.id, '#ff6b6b')}
          />
          <TouchableOpacity 
            style={[
              styles.colorButton, 
              { backgroundColor: '#ffd93d' },
              entry.todo.color === 'yellow' && styles.selectedColor
            ]}
            onPress={() => handleColorChange(entry.id, '#ffd93d')}
          />
          <TouchableOpacity 
            style={[
              styles.colorButton, 
              { backgroundColor: '#6bcb77' },
              entry.todo.color === 'green' && styles.selectedColor
            ]}
            onPress={() => handleColorChange(entry.id, '#6bcb77')}
          />
          <TouchableOpacity 
            style={[
              styles.colorButton, 
              { backgroundColor: '#4d96ff' },
              entry.todo.color === 'blue' && styles.selectedColor
            ]}
            onPress={() => handleColorChange(entry.id, '#4d96ff')}
          />
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons 
              name="archive-outline" 
              size={24} 
              color="#4b5563" 
              style={{ transform: [{ rotate: '180deg' }] }}
            />
          </TouchableOpacity>
          <TouchableOpacity 
          style={styles.iconButton}
          onLongPress={() => handleDeleteEntry(entry.id)}
          delayLongPress={700}
          >
            <Ionicons name="trash-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderTimerInfo = (entry: CalendarEntry) => {
    if (!entry.timeSpent) return null;

    return (
      <View style={styles.timerInfo}>
        <Ionicons name="time" size={14} color="#6b7280" />
        <Text style={styles.timerText}>
          {formatElapsedTime(entry.timeSpent.elapsed)}
        </Text>
      </View>
    );
  };

  const renderTodoText = (entry: CalendarEntry) => {
    if (editingTitleId === entry.id) {
      return (
        <TextInput
          value={editingText}
          onChangeText={setEditingText}
          onBlur={() => handleEndTitleEditing(entry.id)}
          style={[styles.todoText, styles.todoInput]}
          autoFocus
        />
      );
    }
    return (
      <Text 
        style={styles.todoText} 
        numberOfLines={1}
        onPress={() => handleTitlePress(entry.id)}
        onLongPress={() => handleStartTitleEditing(entry)}
      >
        {entry.todo.text || 'Untitled Note'}
      </Text>
    );
  };

  const renderDayView = () => {
    if (!selectedDate) {
      return (
        <View style={styles.container}>
          <Text style={styles.placeholder}>Select a date to view entries</Text>
        </View>
      );
    }

    const dateEntries = entries.filter(entry => {
      const entryDate = new Date(entry.printedAt).toISOString().split('T')[0];
      return entryDate === selectedDate;
    });

    if (dateEntries.length === 0) {
      return <Text style={styles.placeholder}>No entries for this date</Text>;
    }

    return (
      <ScrollView style={styles.dayContainer}>
        {dateEntries.map(entry => (
          <View key={entry.id} style={styles.entryContainer}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                {renderTodoText(entry)}
                {entry.timeSpent && renderTimerInfo(entry)}
              </View>
              <View style={styles.headerRight}>
                <Text style={styles.timestamp}>
                  {new Date(entry.printedAt).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </Text>
              </View>
            </View>
            <TodoItemNote
              todo={entry.todo}
              updateNote={(note) => handleUpdateNote(entry.id, note)}
              onStartEditing={() => {}}
              onEndEditing={() => {}}
            />
            {renderSettings(entry)}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderWeekView = () => {
    return (
      <View style={styles.weekContainer}>
        <ScrollView style={styles.weekContent}>
          <View style={styles.weekRow}>
            {weekDates.map(date => {
              const dateStr = date.toISOString().split('T')[0];
              const dayEntries = entries.filter(entry => {
                const entryDate = new Date(entry.printedAt).toISOString().split('T')[0];
                return entryDate === dateStr;
              });

              return (
                <View key={dateStr} style={styles.dayColumn}>
                  {dayEntries.map(entry => (
                    <View key={entry.id} style={styles.weekEntryItem}>
                      <View style={[
                        styles.weekEntryContent,
                        { backgroundColor: getBackgroundColor(entry.todo.color) }
                      ]}>
                        {editingTitleId === entry.id ? (
                          <TextInput
                            value={editingText}
                            onChangeText={setEditingText}
                            onBlur={() => handleEndTitleEditing(entry.id)}
                            style={[styles.weekEntryText, styles.todoInput]}
                            autoFocus
                            multiline
                          />
                        ) : (
                          <Text 
                            style={styles.weekEntryText} 
                            onLongPress={() => handleStartTitleEditing(entry)}
                          >
                            {entry.todo.text || ''}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  const getBackgroundColor = (color: string): string => {
    switch (color) {
      case 'red':
        return '#fee2e2';
      case 'yellow':
        return '#fef3c7';
      case 'green':
        return '#d1fae5';
      case 'blue':
        return '#dbeafe';
      default:
        return '#f3f4f6';
    }
  };

  return viewMode === 'day' ? (
    <View style={styles.container}>
      {renderDayView()}
    </View>
  ) : (
    <View style={styles.container}>
      {renderWeekView()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  dayContainer: {
    flex: 1,
  },
  placeholder: {
    textAlign: 'center',
    color: '#666',
    padding: 20,
  },
  entryContainer: {
    marginBottom: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todoText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    flex: 1,
  },
  todoInput: {
    padding: 0,
    margin: 0,
  },
  timestamp: {
    fontSize: 12,
    color: '#6b7280',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  timerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  timerText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  weekContainer: {
    flex: 1,
    marginTop: 10,
  },
  weekContent: {
    flex: 1,
  },
  weekRow: {
    flexDirection: 'row',
    paddingTop: 1,
  },
  dayColumn: {
    width: COLUMN_WIDTH,
    minHeight: 50,
    alignItems: 'center',
  },
  weekEntryItem: {
    paddingHorizontal: 3,
    paddingVertical: 4,
    width: COLUMN_WIDTH - 4,
    minHeight: 38,
  },
  weekEntryContent: {
    padding: 2,
    borderRadius: 4,
    flex: 1,
    justifyContent: 'center',
  },
  weekEntryText: {
    fontSize: 12,
    color: '#1f2937',
    flexWrap: 'wrap',
    textAlign: 'center',
  },
  settingsContainer: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    marginTop: 8,
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
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    marginBottom: 10,
  },
  iconButton: {
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedColor: {
    borderWidth: 2,
    borderColor: '#4b5563',
  },
});

export default CalendarEntries;