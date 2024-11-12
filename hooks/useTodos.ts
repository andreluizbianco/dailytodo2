import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Todo } from '../types';

const CURRENT_VERSION = 1;

interface StoredData {
  version: number;
  todos: Todo[];
  archivedTodos: Todo[];
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
  };
};