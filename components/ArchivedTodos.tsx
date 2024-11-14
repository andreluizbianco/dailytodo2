import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TodoList from './TodoList';
import TodoItemNote from './TodoItemNote';
import { Todo, CalendarEntry } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SearchResult {
  type: 'todo' | 'archived' | 'calendar';
  item: Todo | CalendarEntry;
  matchField: 'text' | 'note';
}

interface ArchivedTodosProps {
  archivedTodos: Todo[];
  setArchivedTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  unarchiveTodo: (id: number) => void;
  updateArchivedTodo: (id: number, updates: Partial<Todo>) => void;
  exportData: () => void;
  importData: () => void;
  showSettings: boolean;
  todos: Todo[]; // Add this to access current todos
}

const ArchivedTodos: React.FC<ArchivedTodosProps> = ({
  archivedTodos,
  setArchivedTodos,
  unarchiveTodo,
  updateArchivedTodo,
  exportData,
  importData,
  showSettings,
  todos
}) => {
  const [selectedArchivedTodo, setSelectedArchivedTodo] = useState<Todo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // Search in current todos
    todos.forEach(todo => {
      if (todo.text.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'todo', item: todo, matchField: 'text' });
      }
      if (todo.note.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'todo', item: todo, matchField: 'note' });
      }
    });

    // Search in archived todos
    archivedTodos.forEach(todo => {
      if (todo.text.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'archived', item: todo, matchField: 'text' });
      }
      if (todo.note.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'archived', item: todo, matchField: 'note' });
      }
    });

    // Search in calendar entries
    try {
      const savedEntries = await AsyncStorage.getItem('calendarEntries');
      if (savedEntries) {
        const calendarEntries: CalendarEntry[] = JSON.parse(savedEntries);
        calendarEntries.forEach(entry => {
          if (entry.todo.text.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'calendar', item: entry, matchField: 'text' });
          }
          if (entry.todo.note.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'calendar', item: entry, matchField: 'note' });
          }
        });
      }
    } catch (error) {
      console.error('Error searching calendar entries:', error);
    }

    setSearchResults(results);
  }, [todos, archivedTodos]);


  const renderSearchResults = () => {
    if (!searchQuery.trim()) {
      return null;
    }
  
    if (searchResults.length === 0) {
      return (
        <Text style={styles.emptyText}>No results found</Text>
      );
    }
  
    const getItemText = (result: SearchResult): string => {
      if (result.type === 'calendar') {
        return (result.item as CalendarEntry).todo.text || 'Untitled Note';
      }
      return (result.item as Todo).text || 'Untitled Note';
    };
  
    const getTodoForNote = (result: SearchResult): Todo => {
      if (result.type === 'calendar') {
        return (result.item as CalendarEntry).todo;
      }
      return result.item as Todo;
    };
  
    return (
      <ScrollView style={styles.searchResults}>
        {searchResults.map((result, index) => (
          <View key={index} style={styles.searchResult}>
            <View style={styles.resultHeader}>
              <View style={styles.resultTitleContainer}>
                <Text style={styles.resultText}>
                  {getItemText(result)}
                </Text>
                {result.type === 'calendar' && (result.item as CalendarEntry).timeSpent && (
                  <View style={styles.timerInfo}>
                    <Ionicons name="time" size={14} color="#6b7280" />
                    <Text style={styles.timerText}>
                      {`${(result.item as CalendarEntry).timeSpent?.elapsed}m`}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.resultType}>
                {result.type === 'todo' ? 'Current' : 
                 result.type === 'archived' ? 'Archived' : 
                 'Calendar'}
              </Text>
            </View>
            <TodoItemNote
              todo={getTodoForNote(result)}
              updateNote={() => {}}
              onStartEditing={() => {}}
              onEndEditing={() => {}}
            />
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {showSettings ? (
        <View style={styles.settingsContainer}>
          <Text style={styles.title}>Search & Data Management</Text>
          
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search in all notes..."
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={exportData}>
              <Text style={styles.buttonText}>Export</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={importData}>
              <Text style={styles.buttonText}>Import</Text>
            </TouchableOpacity>
          </View>

          {renderSearchResults()}
        </View>
      ) : (
        <>
          <Text style={styles.title}>Archived Notes</Text>
          {archivedTodos.length > 0 ? (
            <TodoList
              todos={archivedTodos}
              setTodos={setArchivedTodos}
              updateTodo={updateArchivedTodo}
              selectedTodo={selectedArchivedTodo}
              setSelectedTodo={setSelectedArchivedTodo}
              isArchiveView={true}
              unarchiveTodo={unarchiveTodo}
            />
          ) : (
            <Text style={styles.emptyText}>No archived notes</Text>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    padding: 10,
  },
  settingsContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1f2937',
  },
  searchContainer: {
    marginBottom: 20,
  },
  searchInput: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4b5563',
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  searchResults: {
    flex: 1,
  },
  searchResult: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  resultType: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  timerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timerText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default ArchivedTodos;