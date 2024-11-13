import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';
import { Todo, CalendarEntry } from '../types';

const CURRENT_VERSION = 1;

interface StoredData {
  version: number;
  todos: Todo[];
  archivedTodos: Todo[];
  calendarEntries?: CalendarEntry[];
}

export const useTodos = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [archivedTodos, setArchivedTodos] = useState<Todo[]>([]);

  useEffect(() => {
    const loadTodos = async () => {
      try {
        const savedData = await AsyncStorage.getItem('todosData');
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          if (parsedData && parsedData.version === CURRENT_VERSION) {
            setTodos(parsedData.todos);
            setArchivedTodos(parsedData.archivedTodos);
          } else if (Array.isArray(parsedData)) {
            setTodos(parsedData);
            setArchivedTodos([]);
          }
        }
      } catch (e) {
        console.error('Failed to load todos', e);
      }
    };
    loadTodos();
  }, []);

  useEffect(() => {
    const saveTodos = async () => {
      try {
        const dataToSave: StoredData = {
          version: CURRENT_VERSION,
          todos,
          archivedTodos,
        };
        await AsyncStorage.setItem('todosData', JSON.stringify(dataToSave));
      } catch (e) {
        console.error('Failed to save todos', e);
      }
    };
    saveTodos();
  }, [todos, archivedTodos]);

  const addTodo = (): Todo => {
    const newTodo: Todo = {
      id: Date.now(),
      text: '',
      note: '',
      color: 'blue',
      isEditing: true,
      noteType: 'text',
    };
    setTodos(prevTodos => [...prevTodos, newTodo]);
    return newTodo;
  };

  const updateTodo = (id: number, updates: Partial<Todo>): void => {
    setTodos(prevTodos =>
      prevTodos.map(todo => (todo.id === id ? { ...todo, ...updates } : todo)),
    );
    
    //  to save immediately:
    const updatedTodos = todos.map(todo => 
      todo.id === id ? { ...todo, ...updates } : todo
    );
    AsyncStorage.setItem('todos', JSON.stringify(updatedTodos))
      .catch(error => console.error('Error saving todos:', error));
  };

  const updateArchivedTodo = (id: number, updates: Partial<Todo>): void => {
    setArchivedTodos(prevTodos =>
      prevTodos.map(todo => (todo.id === id ? { ...todo, ...updates } : todo)),
    );
  };

  const removeTodo = (id: number): void => {
    setTodos(prevTodos => prevTodos.filter(todo => todo.id !== id));
  };

  const archiveTodo = (id: number): void => {
    const todoToArchive = todos.find(todo => todo.id === id);
    if (todoToArchive) {
      setArchivedTodos(prevArchivedTodos => [
        ...prevArchivedTodos,
        { ...todoToArchive, isEditing: false },
      ]);
      setTodos(prevTodos => prevTodos.filter(todo => todo.id !== id));
    }
  };

  const unarchiveTodo = (id: number): void => {
    const todoToUnarchive = archivedTodos.find(todo => todo.id === id);
    if (todoToUnarchive) {
      setTodos(prevTodos => [...prevTodos, { ...todoToUnarchive, isEditing: false }]);
      setArchivedTodos(prevArchivedTodos =>
        prevArchivedTodos.filter(todo => todo.id !== id),
      );
    }
  };

  const exportData = async () => {
    try {
      const calendarEntriesStr = await AsyncStorage.getItem('calendarEntries');
      const calendarEntries = calendarEntriesStr ? JSON.parse(calendarEntriesStr) : [];
  
      const dataToExport: StoredData = {
        version: CURRENT_VERSION,
        todos,
        archivedTodos,
        calendarEntries
      };

      const jsonString = JSON.stringify(dataToExport, null, 2);
      const fileUri = `${FileSystem.documentDirectory}todos_backup.json`;
      
      await FileSystem.writeAsStringAsync(fileUri, jsonString, {
        encoding: FileSystem.EncodingType.UTF8
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        try {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Export Todos Data',
            UTI: 'public.json' // for iOS
          }).then(() => {
            // Show success message after the share sheet is dismissed and the share was completed
            setTimeout(() => {
              Alert.alert('Success', 'Data exported successfully!');
            }, 500);
          });
        } catch (error) {
          if (error instanceof Error) {
            console.error('Share error:', error.message);
            Alert.alert('Error', 'Failed to share data. Please try again.');
          }
        }
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Error', 'Failed to export data. Please try again.');
    }
  };

  const importData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });

      if (!result.canceled) {
        const fileContents = await FileSystem.readAsStringAsync(result.assets[0].uri);
        const importedData = JSON.parse(fileContents);

        if (importedData.version === CURRENT_VERSION) {
          setTodos(importedData.todos);
          setArchivedTodos(importedData.archivedTodos);
          
          if (importedData.calendarEntries) {
            await AsyncStorage.setItem('calendarEntries', 
              JSON.stringify(importedData.calendarEntries)
            );
          }

          Alert.alert('Success', 'Data imported successfully!');
        } else {
          Alert.alert('Error', 'Incompatible data format');
        }
      }
    } catch (error) {
      console.error('Error importing data:', error);
      Alert.alert('Error', 'Failed to import data. Please try again.');
    }
  };

  return {
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
  };
};