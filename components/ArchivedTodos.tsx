import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import TodoList from './TodoList';
import { Todo } from '../types';
import { Ionicons } from '@expo/vector-icons';

interface ArchivedTodosProps {
  archivedTodos: Todo[];
  setArchivedTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  unarchiveTodo: (id: number) => void;
  updateArchivedTodo: (id: number, updates: Partial<Todo>) => void;
  exportData: () => void;
  importData: () => void;
  showSettings: boolean;
}

const ArchivedTodos: React.FC<ArchivedTodosProps> = ({
  archivedTodos,
  setArchivedTodos,
  unarchiveTodo,
  updateArchivedTodo,
  exportData,
  importData,
  showSettings
}) => {
  const [selectedArchivedTodo, setSelectedArchivedTodo] = useState<Todo | null>(null);

  return (
    <View style={styles.container}>
      {showSettings ? (
        <View style={styles.settingsContainer}>
          <Text style={styles.title}>Data Management</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={exportData}>
              <Ionicons name="download-outline" size={20} color="white" />
              <Text style={styles.buttonText}>Export Data</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={importData}>
              <Ionicons name="push-outline" size={20} color="white" />
              <Text style={styles.buttonText}>Import Data</Text>
            </TouchableOpacity>
          </View>
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
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1f2937',
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#4b5563',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
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