import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TodoItemNote from './TodoItemNote';
import { CalendarEntry } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 40) / 7;

interface CalendarEntriesProps {
  selectedDate: string | null;
  entries: CalendarEntry[];
  setEntries: React.Dispatch<React.SetStateAction<CalendarEntry[]>>;
  viewMode: 'week' | 'day';
  weekDates: Date[];
}

const CalendarEntries: React.FC<CalendarEntriesProps> = ({
  selectedDate,
  entries,
  setEntries,
  viewMode,
  weekDates,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);

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

  const handleDeleteEntry = async (entryId: number) => {
    const updatedEntries = entries.filter(entry => entry.id !== entryId);
    setEntries(updatedEntries);
    await AsyncStorage.setItem('calendarEntries', JSON.stringify(updatedEntries));
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
              <Text style={styles.todoText} numberOfLines={1}>
                {entry.todo.text || 'Untitled Note'}
              </Text>
              <Text style={styles.timestamp}>
                {new Date(entry.printedAt).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </Text>
              <TouchableOpacity
                onPress={() => handleDeleteEntry(entry.id)}
                style={styles.deleteButton}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <TodoItemNote
              todo={entry.todo}
              updateNote={(note) => handleUpdateNote(entry.id, note)}
              onStartEditing={() => setEditingId(entry.id)}
              onEndEditing={() => setEditingId(null)}
            />
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderWeekView = () => {
    return (
      <View style={styles.weekContainer}>
        <View style={styles.weekHeader}>
          {weekDates.map(date => (
            <View key={date.toISOString()} style={styles.dayColumn}>
              <Text style={styles.dayHeader}>
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
            </View>
          ))}
        </View>
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
                      <Text 
                        style={[
                          styles.weekEntryText,
                          { backgroundColor: getBackgroundColor(entry.todo.color) }
                        ]} 
                        numberOfLines={2}
                      >
                        {entry.todo.text || 'Untitled'}
                      </Text>
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
  todoText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#6b7280',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  // Week view styles
  weekContainer: {
    flex: 1,
    marginTop: 10,
  },
  weekHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 8,
  },
  weekContent: {
    flex: 1,
  },
  weekRow: {
    flexDirection: 'row',
    paddingTop: 8,
  },
  dayColumn: {
    width: COLUMN_WIDTH,
    minHeight: 50,
    alignItems: 'center',
  },
  dayHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
    textAlign: 'center',
  },
  weekEntryItem: {
    padding: 4,
    width: COLUMN_WIDTH - 8,
  },
  weekEntryText: {
    fontSize: 12,
    color: '#1f2937',
    padding: 4,
    borderRadius: 4,
  },
});

export default CalendarEntries;