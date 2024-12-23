import React, { useRef, useEffect, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';
import { Todo } from '../types';
import { Ionicons } from '@expo/vector-icons';

interface TodoItemProps {
  todo: Todo;
  selectTodo: () => void;
  isSelected: boolean;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
  stopOtherEdits: () => void;
  onDragStart: () => void;
  isDragging: boolean;
  onLayout: (layout: { x: number; y: number; width: number; height: number; }) => void;
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
    onDragStart,
    isDragging,
    onLayout,
    isArchiveView = false,
    unarchiveTodo,
  }, ref) => {
    const [isEditing, setIsEditing] = React.useState(todo.isEditing);
    const [editedText, setEditedText] = React.useState(todo.text);
    const inputRef = useRef<TextInput>(null);
    const doubleTapRef = useRef(null);

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
    };

    const handleStartEditing = () => {
      setIsEditing(true);
      updateTodo(todo.id, { isEditing: true });
    };

    const handleEndEditing = () => {
      setIsEditing(false);
      // Immediately save the current text when ending edit mode
      updateTodo(todo.id, { 
        text: editedText,
        isEditing: false 
      });
    };

    const handleBlur = () => {
      if (isEditing) {
        handleEndEditing();
      }
    };

    const onSingleTap = (event: any) => {
      if (event.nativeEvent.state === State.ACTIVE) {
        selectTodo();
      }
    };

    const onDoubleTap = (event: any) => {
      if (event.nativeEvent.state === State.ACTIVE) {
        onDragStart();
      }
    };

    const onLongPress = () => {
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

    const getSelectionStyle = () => {
      if (!isSelected) return {};
      switch (todo.color) {
        case 'red':
          return { borderLeftColor: '#ef4444' };
        case 'yellow':
          return { borderLeftColor: '#f59e0b' };
        case 'green':
          return { borderLeftColor: '#10b981' };
        case 'blue':
          return { borderLeftColor: '#3b82f6' };
        default:
          return { borderLeftColor: '#3b82f6' };
      }
    };

    return (
      <TapGestureHandler
        onHandlerStateChange={onSingleTap}
        waitFor={doubleTapRef}>
        <TapGestureHandler
          ref={doubleTapRef}
          onHandlerStateChange={onDoubleTap}
          numberOfTaps={2}>
          <View
            style={[
              styles.container,
              getColorStyle(),
              getSelectionStyle(),
              isDragging && styles.dragging,
            ]}
            onLayout={event => onLayout(event.nativeEvent.layout)}>
            <TouchableOpacity
              onLongPress={onLongPress}
              style={styles.todoContent}
              activeOpacity={0.7}
            >
              {isEditing ? (
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  value={editedText}
                  onChangeText={handleChangeText}
                  onBlur={handleBlur} 
                  multiline
                />
              ) : (
                <Text style={[styles.text, !todo.text && styles.emptyText]}>
                  {todo.text || ''}
                </Text>
              )}
            </TouchableOpacity>
            
            {isArchiveView && unarchiveTodo && (
  <TouchableOpacity
    onLongPress={() => unarchiveTodo(todo.id)}
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
          </View>
        </TapGestureHandler>
      </TapGestureHandler>
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
  dragging: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
      },
      android: {
        elevation: 8,
      },
    }),
    transform: [{ scale: 1.05 }],
  },
  unarchiveButton: {
    padding: 4,
    marginLeft: 10,
    // justifyContent: 'center',
    // alignItems: 'center',
  },
  unarchiveButtonText: {
    color: 'white',
    fontSize: 12,
  },
});

export default TodoItem;