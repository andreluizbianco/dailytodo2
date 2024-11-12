import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TodoItemNote from './TodoItemNote';
import { CalendarEntry } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CalendarEntriesProps {
  selectedDate: string | null;
  entries: CalendarEntry[];
  setEntries: React.Dispatch<React.SetStateAction<CalendarEntry[]>>;
}

const CalendarEntries: React.FC<CalendarEntriesProps> = ({
  selectedDate,
  entries,
  setEntries,
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

  return (
    <ScrollView style={styles.container}>
      {dateEntries.length === 0 ? (
        <Text style={styles.placeholder}>No entries for this date</Text>
      ) : (
        dateEntries.map(entry => (
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
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
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
});

export default CalendarEntries;