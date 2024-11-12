import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import TodoList from './TodoList';
import { Todo } from '../types';

interface ArchivedTodosProps {
  archivedTodos: Todo[];
  setArchivedTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  unarchiveTodo: (id: number) => void;
  updateArchivedTodo: (id: number, updates: Partial<Todo>) => void;
}

const ArchivedTodos: React.FC<ArchivedTodosProps> = ({
  archivedTodos,
  setArchivedTodos,
  unarchiveTodo,
  updateArchivedTodo,
}) => {
  const [selectedArchivedTodo, setSelectedArchivedTodo] = useState<Todo | null>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Archived Todos</Text>
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
        <Text style={styles.emptyText}>No archived todos</Text>
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#6b7280',
  },
});

export default ArchivedTodos;