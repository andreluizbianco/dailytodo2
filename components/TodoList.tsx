import React, { useRef, useState } from "react";
import { View, StyleSheet, ScrollView, Animated } from "react-native";
import { PanGestureHandler } from "react-native-gesture-handler";
import TodoItem, { TodoItemRef } from "./TodoItem";
import TodoItemNote from "./TodoItemNote";
import { Todo } from "../types";
import { useTodoListDrag } from "../hooks/useTodoListDrag";
import { getToggledArchiveSelection } from "../utils/todoSelection";
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
  onNoteBodyDragChange?: (isDragging: boolean) => void;
  onNoteBodyDragMove?: (pageY: number) => number;
  disableDrag?: boolean;
  getTodoKey?: (todo: Todo) => string;
  onReorderTodos?: (todos: Todo[]) => void;
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
  onNoteBodyDragChange,
  onNoteBodyDragMove,
  disableDrag = false,
  getTodoKey = (todo) => String(todo.id),
  onReorderTodos,
}) => {
  const todoRefs = useRef<{ [key: number]: TodoItemRef }>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const scrollPageYRef = useRef(0);
  const scrollViewportHeightRef = useRef(0);
  const scrollContentHeightRef = useRef(0);
  const [isNoteBodyDragging, setIsNoteBodyDragging] = useState(false);
  const {
    draggedItemKey,
    pan,
    itemAnimations,
    onPanGestureEvent,
    onHandlerStateChange,
    handleLayout,
    onDragStart,
    setListLayout,
  } = useTodoListDrag(todos, onReorderTodos ?? setTodos, getTodoKey);

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

  const handleArchiveNoteDragChange = (isDragging: boolean) => {
    setIsNoteBodyDragging(isDragging);
    onNoteBodyDragChange?.(isDragging);

    if (isDragging) {
      scrollViewRef.current &&
        (
          scrollViewRef.current as unknown as {
            measureInWindow: (
              callback: (
                x: number,
                y: number,
                width: number,
                height: number,
              ) => void,
            ) => void;
          }
        ).measureInWindow((_, pageY, __, height) => {
          scrollPageYRef.current = pageY;
          scrollViewportHeightRef.current = height;
        });
    }
  };

  const handleArchiveNoteDragMove = (pageY: number) => {
    const viewportHeight = scrollViewportHeightRef.current;
    if (viewportHeight <= 0) return 0;

    const maxScrollY = Math.max(
      0,
      scrollContentHeightRef.current - viewportHeight,
    );
    const edgeSize = 72;
    const distanceFromTop = pageY - scrollPageYRef.current;
    const distanceFromBottom = scrollPageYRef.current + viewportHeight - pageY;
    let delta = 0;

    if (distanceFromTop < edgeSize) {
      const pressure = Math.max(0, edgeSize - distanceFromTop) / edgeSize;
      delta = -Math.max(2, Math.round(pressure * 6));
    } else if (distanceFromBottom < edgeSize) {
      const pressure = Math.max(0, edgeSize - distanceFromBottom) / edgeSize;
      delta = Math.max(2, Math.round(pressure * 6));
    }

    const outerDelta = onNoteBodyDragMove?.(pageY) ?? 0;

    if (delta === 0) return outerDelta;

    const nextY = Math.max(0, Math.min(maxScrollY, scrollYRef.current + delta));
    const appliedDelta = nextY - scrollYRef.current;

    if (appliedDelta === 0) return outerDelta;

    scrollYRef.current = nextY;
    scrollViewRef.current?.scrollTo({ y: nextY, animated: false });
    return appliedDelta + outerDelta;
  };

  const renderArchiveNoteBody = (
    todo: Todo,
    isSelected: boolean,
    isGrid = false,
  ) => {
    if (!isArchiveView || !isSelected) return null;

    return (
      <View
        style={[
          styles.archiveNoteBodyContainer,
          isGrid && styles.gridArchiveNoteBodyContainer,
        ]}
      >
        <TodoItemNote
          todo={todo}
          updateNote={(note) => updateTodo(todo.id, { note })}
          onStartEditing={() => stopOtherEdits(todo.id)}
          onEndEditing={() => setIsNoteBodyDragging(false)}
          onListDragChange={handleArchiveNoteDragChange}
          onListDragMove={handleArchiveNoteDragMove}
        />
      </View>
    );
  };

  const renderTodoItem = (todo: Todo, useDrag: boolean) => {
    const itemKey = getTodoKey(todo);
    const isSelected = selectedTodo !== null && selectedTodo.id === todo.id;
    const isGrid = columns === 2 && isArchiveView;
    const content = (
      <Animated.View key={itemKey} style={styles.todoItemContainer}>
        <TodoItem
          todo={todo}
          selectTodo={() => handleSelectTodo(todo)}
          isSelected={isSelected}
          updateTodo={updateTodo}
          stopOtherEdits={() => stopOtherEdits(todo.id)}
          onDragStart={useDrag ? () => onDragStart(itemKey) : () => {}}
          isDragging={useDrag && draggedItemKey === itemKey}
          onLayout={(layout) => {
            if (useDrag) {
              handleLayout(itemKey, layout);
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
        {renderArchiveNoteBody(todo, isSelected, isGrid)}
      </Animated.View>
    );

    if (!useDrag) return content;

    return (
      <PanGestureHandler
        key={itemKey}
        onGestureEvent={onPanGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        enabled={draggedItemKey === itemKey}
      >
        {React.cloneElement(content, {
          style: [
            styles.todoItemContainer,
            {
              transform: [
                {
                  translateY:
                    draggedItemKey === itemKey
                      ? pan.y
                      : itemAnimations[itemKey]
                        ? itemAnimations[itemKey]
                        : 0,
                },
              ],
              zIndex: draggedItemKey === itemKey ? 999 : 1,
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
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.gridScrollContent}
          scrollEnabled={!isNoteBodyDragging}
          keyboardShouldPersistTaps="handled"
          onLayout={(event) => {
            scrollViewportHeightRef.current = event.nativeEvent.layout.height;
          }}
          onContentSizeChange={(_, height) => {
            scrollContentHeightRef.current = height;
          }}
          onScroll={(event) => {
            scrollYRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
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
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        scrollEnabled={!isNoteBodyDragging}
        keyboardShouldPersistTaps="handled"
        onLayout={(event) => {
          scrollViewportHeightRef.current = event.nativeEvent.layout.height;
        }}
        onContentSizeChange={(_, height) => {
          scrollContentHeightRef.current = height;
        }}
        onScroll={(event) => {
          scrollYRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {todos.map((todo) => {
          return renderTodoItem(todo, !disableDrag);
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
  archiveNoteBodyContainer: {
    marginLeft: 20,
    marginRight: 12,
    marginTop: 2,
    marginBottom: 8,
  },
  gridArchiveNoteBodyContainer: {
    marginLeft: 8,
    marginRight: 0,
  },
});

export default TodoList;
