export const getArchiveGridRows = <T>(items: T[]): Array<[T, T | null]> => {
  const rows: Array<[T, T | null]> = [];

  for (let index = 0; index < items.length; index += 2) {
    rows.push([items[index], items[index + 1] ?? null]);
  }

  return rows;
};
