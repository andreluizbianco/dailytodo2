import React, { useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Animated,
  Text,
  StyleProp,
  TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PanGestureHandler } from "react-native-gesture-handler";
import TodoItem, { TodoItemRef } from "./TodoItem";
import { Todo } from "../types";
import { useTodoListDrag } from "../hooks/useTodoListDrag";
import { getArchivePreviewItems } from "../utils/archivePreview";
import { getToggledArchiveSelection } from "../utils/todoSelection";
import { getNoteBackgroundColor, useTheme } from "../utils/theme";
import { getArchiveGridRows } from "../utils/archiveLayout";

interface TodoListProps {
  todos: Todo[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
  selectedTodo: Todo | null;
  setSelectedTodo: (todo: Todo | null) => void;
  isArchiveView?: boolean;
  unarchiveTodo?: (id: number) => void;
  columns?: 1 | 2;
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
  columns = 1,
}) => {
  const { noteBodyFontSize, theme } = useTheme();
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
    setSelectedTodo(
      isArchiveView ? getToggledArchiveSelection(selectedTodo, todo) : todo,
    );
  };

  const renderArchivePreview = (
    todo: Todo,
    isSelected: boolean,
    isGrid = false,
  ) => {
    const archivePreviewItems =
      isArchiveView && isSelected
        ? getArchivePreviewItems(todo.note, todo.noteType)
        : [];

    if (archivePreviewItems.length === 0) return null;

    return (
      <View
        style={[
          styles.archivePreviewContainer,
          isGrid && styles.gridArchivePreviewContainer,
          {
            backgroundColor: getNoteBackgroundColor(todo.color, theme),
          },
        ]}
      >
        {archivePreviewItems.map((item, index) => {
          const textDecorationLine: TextStyle["textDecorationLine"] =
            item.type === "checkbox" && item.checked
              ? "line-through"
              : "none";
          const textStyle: StyleProp<TextStyle> = [
            styles.archivePreviewText,
            {
              color:
                item.type === "checkbox" && item.checked
                  ? theme.mutedText
                  : theme.text,
              fontSize: noteBodyFontSize,
              lineHeight: Math.round(noteBodyFontSize * 1.45),
              textDecorationLine,
            },
          ];

          if (item.type === "bullet") {
            return (
              <View key={index} style={styles.archivePreviewRow}>
                <View style={styles.archivePreviewBulletWrap}>
                  <View
                    style={[
                      styles.archivePreviewBullet,
                      { backgroundColor: theme.mutedText },
                    ]}
                  />
                </View>
                <Text style={textStyle}>{item.text}</Text>
              </View>
            );
          }

          if (item.type === "checkbox") {
            return (
              <View key={index} style={styles.archivePreviewRow}>
                <View
                  style={[
                    styles.archivePreviewCheckbox,
                    {
                      borderColor: item.checked ? theme.mutedText : theme.text,
                      backgroundColor: item.checked
                        ? theme.mutedText
                        : "transparent",
                    },
                  ]}
                >
                  {item.checked ? (
                    <Ionicons
                      name="checkmark"
                      size={10}
                      color={theme.elevated}
                    />
                  ) : null}
                </View>
                <Text style={textStyle}>{item.text}</Text>
              </View>
            );
          }

          return (
            <Text key={index} style={textStyle}>
              {item.text}
            </Text>
          );
        })}
      </View>
    );
  };

  const renderTodoItem = (todo: Todo, useDrag: boolean) => {
    const isSelected = selectedTodo !== null && selectedTodo.id === todo.id;
    const isGrid = columns === 2 && isArchiveView;
    const content = (
      <Animated.View style={styles.todoItemContainer}>
        <TodoItem
          todo={todo}
          selectTodo={() => handleSelectTodo(todo)}
          isSelected={isSelected}
          updateTodo={updateTodo}
          stopOtherEdits={() => stopOtherEdits(todo.id)}
          onDragStart={useDrag ? () => onDragStart(todo.id) : () => {}}
          isDragging={useDrag && draggedTodoId === todo.id}
          onLayout={(layout) => {
            if (useDrag) {
              handleLayout(todo.id, layout);
            }
          }}
          isArchiveView={isArchiveView}
          unarchiveTodo={unarchiveTodo}
          horizontalMargin={isGrid ? 0 : 12}
          ref={(ref: TodoItemRef | null) => {
            if (ref) {
              todoRefs.current[todo.id] = ref;
            }
          }}
        />
        {renderArchivePreview(todo, isSelected, isGrid)}
      </Animated.View>
    );

    if (!useDrag) return content;

    return (
      <PanGestureHandler
        key={todo.id}
        onGestureEvent={onPanGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        enabled={draggedTodoId === todo.id}
      >
        {React.cloneElement(content, {
          style: [
            styles.todoItemContainer,
            {
              transform: [
                {
                  translateY:
                    draggedTodoId === todo.id
                      ? pan.y
                      : itemAnimations[todo.id]
                        ? itemAnimations[todo.id]
                        : 0,
                },
              ],
              zIndex: draggedTodoId === todo.id ? 999 : 1,
            },
          ],
        })}
      </PanGestureHandler>
    );
  };

  if (isArchiveView && columns === 2) {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.gridScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {getArchiveGridRows(todos).map(([leftTodo, rightTodo]) => (
            <View key={leftTodo.id} style={styles.gridRow}>
              <View style={styles.gridCell}>
                {renderTodoItem(leftTodo, false)}
              </View>
              <View style={styles.gridCell}>
                {rightTodo ? renderTodoItem(rightTodo, false) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      onLayout={(event) => setListLayout(event.nativeEvent.layout)}
    >
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {todos.map((todo) => {
          return renderTodoItem(todo, true);
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginRight: 0,
  },
  scrollView: {
    flex: 1,
    paddingTop: 8,
  },
  todoItemContainer: {
    marginBottom: ITEM_GAP,
  },
  gridScrollContent: {
    paddingLeft: 4,
    paddingRight: 8,
  },
  gridRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 6,
  },
  gridCell: {
    flex: 1,
    minWidth: 0,
  },
  archivePreviewContainer: {
    borderRadius: 4,
    marginLeft: 20,
    marginRight: 12,
    marginTop: 2,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  archivePreviewText: {
    fontSize: 14,
    flex: 1,
  },
  gridArchivePreviewContainer: {
    marginLeft: 8,
    marginRight: 0,
  },
  archivePreviewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  archivePreviewBulletWrap: {
    width: 14,
    alignItems: "center",
    paddingTop: 9,
    marginRight: 4,
  },
  archivePreviewBullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  archivePreviewCheckbox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 5,
    marginTop: 5,
  },
});

export default TodoList;
