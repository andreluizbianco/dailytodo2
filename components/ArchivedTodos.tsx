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
  todos: Todo[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>; // Add this
  updateTodo: (id: number, updates: Partial<Todo>) => void;
}

const ArchivedTodos: React.FC<ArchivedTodosProps> = ({
  archivedTodos,
  setArchivedTodos,
  unarchiveTodo,
  updateArchivedTodo,
  exportData,
  importData,
  showSettings,
  todos,
  setTodos,
  updateTodo
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

  const handleUpdateNote = async (result: SearchResult, newNote: string) => {
    const updatedTodo = {
      ...(result.type === 'calendar' ? (result.item as CalendarEntry).todo : result.item as Todo),
      note: newNote
    };
  
    try {
      switch (result.type) {
        case 'todo':
          updateTodo(updatedTodo.id, { note: newNote });
          break;
  
        case 'archived':
          updateArchivedTodo(updatedTodo.id, { note: newNote });
          break;
  
        case 'calendar':
          const savedEntries = await AsyncStorage.getItem('calendarEntries');
          if (savedEntries) {
            const entries: CalendarEntry[] = JSON.parse(savedEntries);
            const updatedEntries = entries.map(entry => 
              entry.id === (result.item as CalendarEntry).id 
                ? { ...entry, todo: { ...entry.todo, note: newNote } }
                : entry
            );
            await AsyncStorage.setItem('calendarEntries', JSON.stringify(updatedEntries));
            
            setSearchResults(prev => prev.map(searchResult => 
              searchResult === result 
                ? { 
                    ...searchResult, 
                    item: { 
                      ...(searchResult.item as CalendarEntry),
                      todo: { ...(searchResult.item as CalendarEntry).todo, note: newNote }
                    }
                  }
                : searchResult
            ));
          }
          break;
      }
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

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

    const handleUnarchive = async (result: SearchResult) => {
      if (result.type === 'archived') {
        unarchiveTodo((result.item as Todo).id);
        setSearchResults(prev => prev.filter(r => 
          !(r.type === 'archived' && (r.item as Todo).id === (result.item as Todo).id)
        ));
      } else if (result.type === 'calendar') {
        const calendarEntry = result.item as CalendarEntry;
        
        // Check if entry is from past or future/today
        const entryDate = new Date(calendarEntry.printedAt).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        const isFutureOrToday = entryDate >= today;
        
        // Generate new unique ID
        const uniqueId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
        
        // Create a new todo from the calendar entry
        const newTodo: Todo = {
          ...calendarEntry.todo,
          id: uniqueId,
          isEditing: false,
          color: calendarEntry.todo.color || 'blue',
          noteType: calendarEntry.todo.noteType || 'text',
          text: calendarEntry.todo.text || '',
          note: calendarEntry.todo.note || '',
          createdAt: calendarEntry.printedAt,
          restoredFrom: {
            type: 'calendar',
            originalId: calendarEntry.id,
            timestamp: new Date().toISOString()
          }
        };
        
        // Update todos with duplicate checking
        setTodos(currentTodos => {
          const isDuplicate = currentTodos.some((todo: Todo) => 
            todo.text === newTodo.text && 
            todo.note === newTodo.note &&
            Math.abs(new Date(todo.createdAt || 0).getTime() - 
                    new Date(calendarEntry.printedAt).getTime()) < 1000
          );
          
          if (isDuplicate) {
            console.warn('Duplicate todo detected, skipping...');
            return currentTodos;
          }
          
          return [...currentTodos, newTodo];
        });
        
        try {
          // Only remove from calendar entries and search results if it's a future/today entry
          if (isFutureOrToday) {
            const savedEntries = await AsyncStorage.getItem('calendarEntries');
            if (savedEntries) {
              const entries: CalendarEntry[] = JSON.parse(savedEntries);
              const updatedEntries = entries.filter(entry => entry.id !== calendarEntry.id);
              await AsyncStorage.setItem('calendarEntries', JSON.stringify(updatedEntries));
              
              // Remove from search results only if it's a future/today entry
              setSearchResults(prev => prev.filter(r => 
                !(r.type === 'calendar' && (r.item as CalendarEntry).id === calendarEntry.id)
              ));
            }
          }
    
          // Always update AsyncStorage for todos
          const savedData = await AsyncStorage.getItem('todosData');
          const currentData = savedData ? JSON.parse(savedData) : { todos: [], archivedTodos: [] };
          
          const isDuplicateInStorage = currentData.todos.some((todo: Todo) => 
            todo.text === newTodo.text && 
            todo.note === newTodo.note &&
            Math.abs(new Date(todo.createdAt || 0).getTime() - 
                    new Date(calendarEntry.printedAt).getTime()) < 1000
          );
          
          if (!isDuplicateInStorage) {
            currentData.todos.push(newTodo);
            await AsyncStorage.setItem('todosData', JSON.stringify(currentData));
          }
        } catch (error) {
          console.error('Error handling calendar unarchive:', error);
        }
      }
    };
  
    return (
      <ScrollView style={styles.searchResults}>
        {searchResults.map((result, index) => (
          <View key={index} style={styles.searchResult}>
            <View style={styles.resultHeader}>
              <View style={styles.resultTitleContainer}>
                <Text style={styles.resultText} numberOfLines={2}>  {/* Changed to 2 lines */}
                  {getItemText(result)}
                </Text>
              </View>
              <View style={styles.headerActions}>
                {(result.type === 'archived' || result.type === 'calendar') && (
                  <TouchableOpacity
                    onLongPress={() => handleUnarchive(result)}
                    delayLongPress={650}
                    style={styles.unarchiveButton}
                  >
                    <Ionicons 
                      name="archive-outline" 
                      size={20} 
                      color="#6b7280" 
                      style={{ transform: [{ rotate: '180deg' }] }}
                    />
                  </TouchableOpacity>
                )}
                <View style={styles.resultType}>
                  {result.type === 'archived' && (
                    <Text style={styles.typeText}>Archived</Text>
                  )}
                  {result.type === 'calendar' && (
                    <View style={styles.calendarInfo}>
                      <Ionicons name="calendar-outline" size={14} color="#6b7280" />
                      <Text style={styles.dateText}>
                        {new Date((result.item as CalendarEntry).printedAt)
                          .toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: '2-digit'
                          })}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <TodoItemNote
              todo={getTodoForNote(result)}
              updateNote={(note) => handleUpdateNote(result, note)}
              onStartEditing={() => {}}
              onEndEditing={() => {}}
            />
          </View>
        ))}
      </ScrollView>
    );
  };

  if (showSettings) {
    return (
      <View style={styles.container}>
        <View style={styles.settingsContainer}>
          <Text style={styles.title}>Data Management</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={exportData}>
              <Text style={styles.buttonText}>Export</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={importData}>
              <Text style={styles.buttonText}>Import</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Archived Notes</Text>
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search in all notes..."
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
        />
      </View>
    

      {searchQuery ? renderSearchResults() : (
        archivedTodos.length > 0 ? (
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
        )
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
    alignItems: 'flex-start', // Changed from 'center' to allow multiline
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  resultTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginRight: 8,
  },
  resultText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    flexShrink: 1, // Allows text to shrink if needed
  },
  resultType: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0, // Prevents shrinking of buttons and date
  },
  unarchiveButton: {
    padding: 4,
  },
  calendarInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
});

export default ArchivedTodos;