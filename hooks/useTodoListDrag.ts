import { useRef, useState, useCallback, useEffect } from 'react';
import { Animated, LayoutRectangle } from 'react-native';
import {
  PanGestureHandlerStateChangeEvent,
  PanGestureHandlerGestureEvent,
  State,
} from 'react-native-gesture-handler';
const ITEM_GAP = 3;
const SPRING_CONFIG = {
  useNativeDriver: true,
  friction: 7,
  tension: 360,
};

export const useTodoListDrag = <Item>(
  items: Item[],
  reorderItems: (items: Item[]) => void,
  getItemKey: (item: Item) => string,
) => {
  const [draggedItemKey, setDraggedItemKey] = useState<string | null>(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const itemLayouts = useRef<Record<string, LayoutRectangle>>({});
  const listLayout = useRef<LayoutRectangle | null>(null);
  const itemAnimations = useRef<Record<string, Animated.Value>>({});

  useEffect(() => {
    items.forEach((item) => {
      const key = getItemKey(item);

      if (!itemAnimations.current[key]) {
        itemAnimations.current[key] = new Animated.Value(0);
      }
    });

    Object.keys(itemAnimations.current).forEach((key) => {
      if (!items.some((item) => getItemKey(item) === key)) {
        delete itemAnimations.current[key];
      }
    });
  }, [getItemKey, items]);

  const getItemHeight = (key: string) => {
    return itemLayouts.current[key]?.height || 0;
  };

  const getItemOffset = (index: number) => {
    return items.slice(0, index).reduce((sum, item, i) => {
      return sum + getItemHeight(getItemKey(item)) + (i > 0 ? ITEM_GAP : 0);
    }, 0);
  };

  const getTargetIndex = useCallback(
    (draggedIdx: number, translationY: number) => {
      if (draggedIdx < 0) return -1;

      const draggedItem = items[draggedIdx];
      const draggedHeight = getItemHeight(getItemKey(draggedItem));
      const draggedCenter =
        getItemOffset(draggedIdx) + translationY + draggedHeight / 2;
      let targetIndex = items.length;

      for (let index = 0; index < items.length; index += 1) {
        if (index === draggedIdx) continue;

        const itemHeight = getItemHeight(getItemKey(items[index]));
        const itemCenter = getItemOffset(index) + itemHeight / 2;

        if (draggedCenter < itemCenter) {
          targetIndex = index;
          break;
        }
      }

      return targetIndex > draggedIdx ? targetIndex - 1 : targetIndex;
    },
    [getItemKey, items],
  );

  const animateItemsForTargetIndex = useCallback(
    (draggedIdx: number, targetIdx: number) => {
      if (draggedIdx < 0 || targetIdx < 0) return;

      const draggedItem = items[draggedIdx];
      const draggedHeight = getItemHeight(getItemKey(draggedItem));

      items.forEach((item, index) => {
        const itemKey = getItemKey(item);

        if (index === draggedIdx || !itemAnimations.current[itemKey]) return;

        let targetPosition = 0;

        if (targetIdx > draggedIdx && index > draggedIdx && index <= targetIdx) {
          targetPosition = -(draggedHeight + ITEM_GAP);
        } else if (
          targetIdx < draggedIdx &&
          index >= targetIdx &&
          index < draggedIdx
        ) {
          targetPosition = draggedHeight + ITEM_GAP;
        }

        Animated.spring(itemAnimations.current[itemKey], {
          toValue: targetPosition,
          ...SPRING_CONFIG,
        }).start();
      });
    },
    [getItemKey, items],
  );

  const onPanGestureEvent = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      if (draggedItemKey !== null && listLayout.current) {
        const draggedIdx = items.findIndex(
          (item) => getItemKey(item) === draggedItemKey,
        );
        const newTranslationY = event.nativeEvent.translationY;

        Animated.event([{nativeEvent: {translationY: pan.y}}], {
          useNativeDriver: false,
        })({
          nativeEvent: {
            translationY: newTranslationY,
            translationX: 0,
          },
        });

        animateItemsForTargetIndex(
          draggedIdx,
          getTargetIndex(draggedIdx, newTranslationY),
        );
      }
    },
    [
      animateItemsForTargetIndex,
      draggedItemKey,
      getItemKey,
      getTargetIndex,
      items,
      pan.y,
    ],
  );

  const onHandlerStateChange = useCallback(
    (event: PanGestureHandlerStateChangeEvent) => {
      if (event.nativeEvent.oldState === State.ACTIVE && draggedItemKey !== null) {
        const draggedIdx = items.findIndex(
          (item) => getItemKey(item) === draggedItemKey,
        );
        const newIdx = getTargetIndex(
          draggedIdx,
          event.nativeEvent.translationY,
        );

        if (draggedIdx !== newIdx) {
          const nextItems = [...items];
          const [removed] = nextItems.splice(draggedIdx, 1);
          nextItems.splice(newIdx, 0, removed);
          reorderItems(nextItems);
        }

        setDraggedItemKey(null);
        pan.setValue({x: 0, y: 0});

        Object.values(itemAnimations.current).forEach(animation => {
          animation.setValue(0);
        });
      }
    },
    [draggedItemKey, getItemKey, getTargetIndex, items, pan, reorderItems],
  );

  const handleLayout = useCallback((key: string, layout: LayoutRectangle) => {
    itemLayouts.current[key] = layout;
  }, []);

  const onDragStart = useCallback((key: string) => {
    setDraggedItemKey(key);
  }, []);

  const setListLayout = useCallback((layout: LayoutRectangle) => {
    listLayout.current = layout;
  }, []);

  return {
    draggedItemKey,
    pan,
    itemAnimations: itemAnimations.current,
    onPanGestureEvent,
    onHandlerStateChange,
    handleLayout,
    onDragStart,
    setListLayout,
  };
};
