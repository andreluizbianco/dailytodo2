import React, { useRef, useEffect, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Todo } from '../types';

interface TodoItemProps {
  todo: Todo;
  selectTodo: () => void;
  isSelected: boolean;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
  stopOtherEdits: () => void;
  isArchiveView?: boolean;
  unarchiveTodo?: (id: number) => void;
}

export interface TodoItemRef {
  stopEditing: () => void;
}

const TodoItem = forwardRef<TodoItemRef, TodoItemProps>(
  ({ 
    todo, 
    selectTodo, 
    isSelected, 
    updateTodo, 
    stopOtherEdits,
    isArchiveView = false,
    unarchiveTodo
  }, ref) => {
    const [isEditing, setIsEditing] = React.useState(todo.isEditing);
    const [editedText, setEditedText] = React.useState(todo.text);
    const inputRef = useRef<TextInput>(null);

    React.useImperativeHandle(ref, () => ({
      stopEditing: () => {
        if (isEditing) {
          handleEndEditing();
        }
      },
    }));

    useEffect(() => {
      setEditedText(todo.text);
      setIsEditing(todo.isEditing);
    }, [todo.text, todo.isEditing]);

    useEffect(() => {
      if (isEditing) {
        inputRef.current?.focus();
      }
    }, [isEditing]);

    const handleChangeText = (text: string) => {
      setEditedText(text);
      updateTodo(todo.id, { text });
    };

    const handleStartEditing = () => {
      setIsEditing(true);
      updateTodo(todo.id, { isEditing: true });
    };

    const handleEndEditing = () => {
      setIsEditing(false);
      updateTodo(todo.id, { isEditing: false });
    };

    const handlePress = () => {
      selectTodo();
    };

    const handleDoublePress = () => {
      stopOtherEdits();
      selectTodo();
      handleStartEditing();
    };

    const getColorStyle = () => {
      switch (todo.color) {
        case 'red':
          return styles.redTodo;
        case 'yellow':
          return styles.yellowTodo;
        case 'green':
          return styles.greenTodo;
        case 'blue':
          return styles.blueTodo;
        default:
          return {};
      }
    };

    return (
      <View style={[
        styles.container,
        getColorStyle(),
        isSelected && styles.selectedTodo,
      ]}>
        <TouchableOpacity
          onPress={handlePress}
          onLongPress={handleDoublePress}
          style={styles.todoContent}
        >
          {isEditing ? (
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={editedText}
              onChangeText={handleChangeText}
              onBlur={handleEndEditing}
              multiline
            />
          ) : (
            <Text style={[styles.text, !todo.text && styles.emptyText]}>
              {todo.text || 'New Todo'}
            </Text>
          )}
        </TouchableOpacity>
        
        {isArchiveView && unarchiveTodo && (
          <TouchableOpacity
            style={styles.unarchiveButton}
            onPress={() => unarchiveTodo(todo.id)}
          >
            <Text style={styles.unarchiveButtonText}>Unarchive</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    padding: 10,
    marginBottom: 5,
    minHeight: 44,
    borderRadius: 4,
    backgroundColor: 'white',
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  todoContent: {
    flex: 1,
  },
  text: {
    fontSize: 14,
    color: '#1f2937',
  },
  emptyText: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  input: {
    fontSize: 14,
    color: '#1f2937',
    padding: 0,
    margin: 0,
  },
  selectedTodo: {
    borderLeftColor: '#3b82f6',
  },
  redTodo: {
    backgroundColor: '#fee2e2',
  },
  yellowTodo: {
    backgroundColor: '#fef3c7',
  },
  greenTodo: {
    backgroundColor: '#d1fae5',
  },
  blueTodo: {
    backgroundColor: '#dbeafe',
  },
  unarchiveButton: {
    backgroundColor: '#6b7280',
    padding: 5,
    borderRadius: 4,
    marginLeft: 10,
  },
  unarchiveButtonText: {
    color: 'white',
    fontSize: 12,
  },
});

export default TodoItem;