import { useRef, useState, useCallback, useEffect } from 'react';
import { Animated, LayoutRectangle } from 'react-native';
import {
  PanGestureHandlerStateChangeEvent,
  PanGestureHandlerGestureEvent,
  State,
} from 'react-native-gesture-handler';
import { Todo } from '../types';

const ITEM_GAP = 3;

export const useTodoListDrag = (
  todos: Todo[],
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>,
) => {
  const [draggedTodoId, setDraggedTodoId] = useState<number | null>(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const itemLayouts = useRef<{[key: number]: LayoutRectangle}>({});
  const listLayout = useRef<LayoutRectangle | null>(null);
  const itemAnimations = useRef<{[key: number]: Animated.Value}>({});

  useEffect(() => {
    todos.forEach(todo => {
      if (!itemAnimations.current[todo.id]) {
        itemAnimations.current[todo.id] = new Animated.Value(0);
      }
    });

    Object.keys(itemAnimations.current).forEach(id => {
      if (!todos.some(todo => todo.id === Number(id))) {
        delete itemAnimations.current[Number(id)];
      }
    });
  }, [todos]);

  const getItemHeight = (id: number) => {
    return itemLayouts.current[id]?.height || 0;
  };

  const getItemOffset = (index: number) => {
    return todos.slice(0, index).reduce((sum, todo, i) => {
      return sum + getItemHeight(todo.id) + (i > 0 ? ITEM_GAP : 0);
    }, 0);
  };

  const onPanGestureEvent = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      if (draggedTodoId !== null && listLayout.current) {
        const draggedIdx = todos.findIndex(todo => todo.id === draggedTodoId);
        const draggedItemHeight = getItemHeight(draggedTodoId);

        let newTranslationY = event.nativeEvent.translationY;

        Animated.event([{nativeEvent: {translationY: pan.y}}], {
          useNativeDriver: false,
        })({
          nativeEvent: {
            translationY: newTranslationY,
            translationX: 0,
          },
        });

        const draggedTop = getItemOffset(draggedIdx) + newTranslationY;
        const draggedBottom = draggedTop + draggedItemHeight;

        todos.forEach((todo, index) => {
          if (index !== draggedIdx && itemAnimations.current[todo.id]) {
            const itemTop = getItemOffset(index);
            const itemBottom = itemTop + getItemHeight(todo.id);
            const itemCenter = (itemTop + itemBottom) / 2;

            let targetPosition = 0;
            if (index < draggedIdx && draggedTop < itemCenter) {
              targetPosition = draggedItemHeight + ITEM_GAP;
            } else if (index > draggedIdx && draggedBottom > itemCenter) {
              targetPosition = -(draggedItemHeight + ITEM_GAP);
            }

            Animated.spring(itemAnimations.current[todo.id], {
              toValue: targetPosition,
              useNativeDriver: true,
              friction: 5,
              tension: 300,
            }).start();
          }
        });
      }
    },
    [draggedTodoId, pan.y, todos],
  );

  const onHandlerStateChange = useCallback(
    (event: PanGestureHandlerStateChangeEvent) => {
      if (event.nativeEvent.oldState === State.ACTIVE && draggedTodoId !== null) {
        const draggedIdx = todos.findIndex(todo => todo.id === draggedTodoId);
        const draggedItemHeight = getItemHeight(draggedTodoId);
        const draggedTop = getItemOffset(draggedIdx) + event.nativeEvent.translationY;
        const draggedBottom = draggedTop + draggedItemHeight;

        let newIdx = todos.findIndex((_, index) => {
          if (index === draggedIdx) return false;
          const itemTop = getItemOffset(index);
          const itemBottom = itemTop + getItemHeight(todos[index].id);

          if (index < draggedIdx) {
            return draggedTop < (itemTop + itemBottom) / 2;
          } else {
            return draggedBottom < (itemTop + itemBottom) / 2;
          }
        });

        if (newIdx === -1) {
          newIdx = todos.length;
        } else if (newIdx > draggedIdx) {
          newIdx--;
        }

        if (draggedIdx !== newIdx) {
          const newTodos = [...todos];
          const [removed] = newTodos.splice(draggedIdx, 1);
          newTodos.splice(newIdx, 0, removed);
          setTodos(newTodos);
        }

        setDraggedTodoId(null);
        pan.setValue({x: 0, y: 0});

        Object.values(itemAnimations.current).forEach(animation => {
          animation.setValue(0);
        });
      }
    },
    [todos, draggedTodoId, pan, setTodos],
  );

  const handleLayout = useCallback((id: number, layout: LayoutRectangle) => {
    itemLayouts.current[id] = layout;
  }, []);

  const onDragStart = useCallback((todoId: number) => {
    setDraggedTodoId(todoId);
  }, []);

  const setListLayout = useCallback((layout: LayoutRectangle) => {
    listLayout.current = layout;
  }, []);

  return {
    draggedTodoId,
    pan,
    itemAnimations: itemAnimations.current,
    onPanGestureEvent,
    onHandlerStateChange,
    handleLayout,
    onDragStart,
    setListLayout,
  };
};