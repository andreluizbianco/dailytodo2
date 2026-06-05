import React, { useRef, useEffect, forwardRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Todo } from "../types";
import { Ionicons } from "@expo/vector-icons";
import { softHaptic, withLongPressHaptic } from "../utils/haptics";
import { getNoteBackgroundColor, useTheme } from "../utils/theme";

interface TodoItemProps {
  todo: Todo;
  selectTodo: () => void;
  isSelected: boolean;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
  stopOtherEdits: () => void;
  onDragStart: () => void;
  isDragging: boolean;
  onLayout: (layout: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  isArchiveView?: boolean;
  unarchiveTodo?: (id: number) => void;
  horizontalMargin?: number;
}

export interface TodoItemRef {
  stopEditing: () => void;
}

const TodoItem = forwardRef<TodoItemRef, TodoItemProps>(
  (
    {
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
      horizontalMargin = 12,
    },
    ref,
  ) => {
    const { noteTitleFontSize, theme } = useTheme();
    const [isEditing, setIsEditing] = React.useState(todo.isEditing);
    const [editedText, setEditedText] = React.useState(todo.text);
    const inputRef = useRef<TextInput>(null);
    const lastTapRef = useRef(0);

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
        isEditing: false,
      });
    };

    const handleBlur = () => {
      if (isEditing) {
        handleEndEditing();
      }
    };

    const handlePress = () => {
      const now = Date.now();
      const isDoubleTap = now - lastTapRef.current < 320;

      lastTapRef.current = now;
      selectTodo();

      if (isDoubleTap) {
        lastTapRef.current = 0;
        onDragStart();
      }
    };

    const onLongPress = () => {
      softHaptic();
      stopOtherEdits();
      selectTodo();
      handleStartEditing();
    };

    const getColorStyle = () => {
      return { backgroundColor: getNoteBackgroundColor(todo.color, theme) };
    };

    const getSelectionStyle = () => {
      if (!isSelected) return {};
      switch (todo.color) {
        case "red":
          return { borderLeftColor: "#ef4444" };
        case "yellow":
          return { borderLeftColor: "#f59e0b" };
        case "green":
          return { borderLeftColor: "#10b981" };
        case "blue":
          return { borderLeftColor: "#3b82f6" };
        default:
          return { borderLeftColor: "#3b82f6" };
      }
    };

    return (
      <View
        style={[
          styles.container,
          getColorStyle(),
          getSelectionStyle(),
          isDragging && styles.dragging,
          { marginHorizontal: horizontalMargin },
        ]}
        onLayout={(event) => onLayout(event.nativeEvent.layout)}
      >
        <TouchableOpacity
          onLongPress={onLongPress}
          onPress={handlePress}
          style={styles.todoContent}
          activeOpacity={0.7}
        >
          {isEditing ? (
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                { color: theme.text, fontSize: noteTitleFontSize },
              ]}
              placeholderTextColor={theme.subtleText}
              value={editedText}
              onChangeText={handleChangeText}
              onBlur={handleBlur}
              multiline
            />
          ) : (
            <Text
              style={[
                styles.text,
                { color: theme.text, fontSize: noteTitleFontSize },
                !todo.text && [
                  styles.emptyText,
                  { color: theme.subtleText },
                ],
              ]}
            >
              {todo.text || ""}
            </Text>
          )}
        </TouchableOpacity>

        {isArchiveView && unarchiveTodo && (
          <TouchableOpacity
            onLongPress={withLongPressHaptic(() => unarchiveTodo(todo.id))}
            delayLongPress={650}
            style={styles.unarchiveButton}
          >
            <Ionicons
              name="archive-outline"
              size={20}
              color={theme.mutedText}
              style={{ transform: [{ rotate: "180deg" }] }}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    padding: 10,
    marginBottom: 5,
    minHeight: 44,
    borderRadius: 4,
    backgroundColor: "white",
    borderLeftWidth: 4,
    borderLeftColor: "transparent",
    marginHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    ...Platform.select({
      android: {
        elevation: 0.6,
      },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.045,
        shadowRadius: 1.2,
      },
    }),
  },
  todoContent: {
    flex: 1,
  },
  text: {
    fontSize: 14,
  },
  emptyText: {
    color: "#9ca3af",
    fontStyle: "italic",
  },
  input: {
    fontSize: 14,
    padding: 0,
    margin: 0,
  },
  redTodo: {
    backgroundColor: "#fee2e2",
  },
  yellowTodo: {
    backgroundColor: "#fef3c7",
  },
  greenTodo: {
    backgroundColor: "#d1fae5",
  },
  blueTodo: {
    backgroundColor: "#dbeafe",
  },
  dragging: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    color: "white",
    fontSize: 12,
  },
});

export default TodoItem;
