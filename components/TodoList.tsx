import React, { useRef } from 'react';
import { View, StyleSheet, ScrollView, Animated } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import TodoItem, { TodoItemRef } from './TodoItem';
import { Todo } from '../types';
import { useTodoListDrag } from '../hooks/useTodoListDrag';

interface TodoListProps {
  todos: Todo[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
  selectedTodo: Todo | null;
  setSelectedTodo: (todo: Todo) => void;
  isArchiveView?: boolean;
  unarchiveTodo?: (id: number) => void;
}

const ITEM_GAP = 3;

const TodoList: React.FC<TodoListProps> = ({
  todos,
  setTodos,
  updateTodo,
  selectedTodo,
  setSelectedTodo,
  isArchiveView = false,
  unarchiveTodo,
}) => {
  const todoRefs = useRef<{ [key: number]: TodoItemRef }>({});
  const {
    draggedTodoId,
    pan,
    itemAnimations,
    onPanGestureEvent,
    onHandlerStateChange,
    handleLayout,
    onDragStart,
    setListLayout,
  } = useTodoListDrag(todos, setTodos);

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
    <View 
      style={styles.container}
      onLayout={event => setListLayout(event.nativeEvent.layout)}
    >
      <ScrollView style={styles.scrollView}>
        {todos.map(todo => (
          <PanGestureHandler
            key={todo.id}
            onGestureEvent={onPanGestureEvent}
            onHandlerStateChange={onHandlerStateChange}
            enabled={draggedTodoId === todo.id}>
            <Animated.View
              style={[
                styles.todoItemContainer,
                {
                  transform: [
                    {
                      translateY: draggedTodoId === todo.id
                        ? pan.y
                        : itemAnimations[todo.id]
                        ? itemAnimations[todo.id]
                        : 0,
                    },
                  ],
                  zIndex: draggedTodoId === todo.id ? 999 : 1,
                },
              ]}>
              <TodoItem
                todo={todo}
                selectTodo={() => handleSelectTodo(todo)}
                isSelected={selectedTodo !== null && selectedTodo.id === todo.id}
                updateTodo={updateTodo}
                stopOtherEdits={() => stopOtherEdits(todo.id)}
                onDragStart={() => onDragStart(todo.id)}
                isDragging={draggedTodoId === todo.id}
                onLayout={layout => handleLayout(todo.id, layout)}
                isArchiveView={isArchiveView}
                unarchiveTodo={unarchiveTodo}
                ref={(ref: TodoItemRef | null) => {
                  if (ref) {
                    todoRefs.current[todo.id] = ref;
                  }
                }}
              />
            </Animated.View>
          </PanGestureHandler>
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
  todoItemContainer: {
    marginBottom: ITEM_GAP,
  },
});

export default TodoList;