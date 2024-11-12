import React, { useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import TodoItem, { TodoItemRef } from './TodoItem';
import { Todo } from '../types';

interface TodoListProps {
  todos: Todo[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
  selectedTodo: Todo | null;
  setSelectedTodo: (todo: Todo) => void;
  isArchiveView?: boolean;
  unarchiveTodo?: (id: number) => void;
}

const TodoList: React.FC<TodoListProps> = ({
  todos,
  updateTodo,
  selectedTodo,
  setSelectedTodo,
  isArchiveView = false,
  unarchiveTodo,
}) => {
  const todoRefs = useRef<{ [key: number]: TodoItemRef }>({});

  const stopOtherEdits = (currentTodoId: number) => {
    Object.entries(todoRefs.current).forEach(([id, ref]) => {
      if (parseInt(id) !== currentTodoId) {
        ref.stopEditing();
      }
    });
  };

  const handleSelectTodo = (todo: Todo) => {
    stopOtherEdits(todo.id);
    setSelectedTodo(todo);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {todos.map(todo => (
          <TodoItem
            key={todo.id}
            todo={todo}
            selectTodo={() => handleSelectTodo(todo)}
            isSelected={selectedTodo !== null && selectedTodo.id === todo.id}
            updateTodo={updateTodo}
            stopOtherEdits={() => stopOtherEdits(todo.id)}
            isArchiveView={isArchiveView}
            unarchiveTodo={unarchiveTodo}
            ref={(ref: TodoItemRef | null) => {
              if (ref) {
                todoRefs.current[todo.id] = ref;
              }
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginRight: 10,
  },
  scrollView: {
    flex: 1,
    paddingTop: 8,
  },
});

export default TodoList;