import { TodayTodoItem } from "../types";

const WITHOUT_TIME_SORT_VALUE = Number.MAX_SAFE_INTEGER;

export const sortTodayItemsByDisplayTime = (
  items: TodayTodoItem[],
): TodayTodoItem[] => {
  return [...items].sort((left, right) => {
    const leftTime = left.sortTimeMinutes ?? WITHOUT_TIME_SORT_VALUE;
    const rightTime = right.sortTimeMinutes ?? WITHOUT_TIME_SORT_VALUE;

    if (leftTime !== rightTime) return leftTime - rightTime;

    return items.indexOf(left) - items.indexOf(right);
  });
};

export const applyTodayDisplayOrder = (
  items: TodayTodoItem[],
  orderKeys: string[] | null,
): TodayTodoItem[] => {
  if (!orderKeys || orderKeys.length === 0) {
    return sortTodayItemsByDisplayTime(items);
  }

  const itemsByKey = new Map(items.map((item) => [item.occurrenceKey, item]));
  const orderedItems: TodayTodoItem[] = [];

  for (const key of orderKeys) {
    const item = itemsByKey.get(key);
    if (!item) continue;

    orderedItems.push(item);
    itemsByKey.delete(key);
  }

  return [
    ...orderedItems,
    ...sortTodayItemsByDisplayTime([...itemsByKey.values()]),
  ];
};

export const createTodayDisplayOrder = (items: TodayTodoItem[]) => {
  return items.map((item) => item.occurrenceKey);
};
