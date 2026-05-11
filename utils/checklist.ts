export interface ChecklistItem {
  checked: boolean;
  text: string;
}

export interface BulletItem {
  text: string;
  checked?: boolean;
}

export type NoteType = "text" | "bullet" | "checkbox";

const CHECKLIST_LINE_PATTERN = /^\[( |x|X)\]\s?(.*)$/;
const BULLET_LINE_PATTERN = /^\s*(?:-|\u2022)\s?(.*)$/;

const stripBulletPrefix = (line: string): string => {
  const bulletMatch = line.match(BULLET_LINE_PATTERN);
  return bulletMatch ? bulletMatch[1] : line;
};

const parseChecklistLine = (line: string): ChecklistItem => {
  const lineWithoutBullet = stripBulletPrefix(line);
  const match = lineWithoutBullet.match(CHECKLIST_LINE_PATTERN);

  if (!match) {
    return { checked: false, text: lineWithoutBullet };
  }

  return {
    checked: match[1].toLowerCase() === "x",
    text: match[2],
  };
};

export const normalizeChecklistItems = (
  items: ChecklistItem[],
): ChecklistItem[] => [
  ...items.filter((item) => !item.checked),
  ...items.filter((item) => item.checked),
];

export const parseChecklistNote = (note: string): ChecklistItem[] => {
  if (!note.trim()) return [];

  return note.split("\n").map(parseChecklistLine);
};

export const serializeChecklistItems = (items: ChecklistItem[]): string =>
  items
    .map((item) => `${item.checked ? "[x]" : "[ ]"} ${item.text}`)
    .join("\n");

export const addChecklistItem = (
  items: ChecklistItem[],
  text = "",
): ChecklistItem[] =>
  normalizeChecklistItems([...items, { checked: false, text }]);

export const updateChecklistItemText = (
  items: ChecklistItem[],
  index: number,
  text: string,
): ChecklistItem[] =>
  items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, text } : item,
  );

export const splitChecklistItem = (
  items: ChecklistItem[],
  index: number,
  leadingText: string,
): ChecklistItem[] => {
  if (index < 0 || index >= items.length) return items;

  const currentItem = items[index];
  const trailingText = currentItem.text.slice(leadingText.length);
  const nextItems = [...items];

  nextItems.splice(
    index,
    1,
    { ...currentItem, text: leadingText },
    { checked: false, text: trailingText },
  );

  return normalizeChecklistItems(nextItems);
};

export const removeChecklistItem = (
  items: ChecklistItem[],
  index: number,
): ChecklistItem[] => {
  if (index < 0 || index >= items.length) return items;

  return items.filter((_, itemIndex) => itemIndex !== index);
};

export const toggleChecklistItem = (
  items: ChecklistItem[],
  index: number,
): ChecklistItem[] =>
  normalizeChecklistItems(
    items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, checked: !item.checked } : item,
    ),
  );

export const reorderChecklistItem = (
  items: ChecklistItem[],
  fromIndex: number,
  toIndex: number,
): ChecklistItem[] => {
  if (fromIndex === toIndex) return items;
  if (fromIndex < 0 || fromIndex >= items.length) return items;

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  const nextIndex = Math.max(0, Math.min(toIndex, nextItems.length));

  nextItems.splice(nextIndex, 0, movedItem);
  return normalizeChecklistItems(nextItems);
};

export const parseBulletNote = (note: string): BulletItem[] => {
  if (!note.trim()) return [];

  return note.split("\n").map((line) => {
    const parsedLine = parseChecklistLine(line);
    return { checked: parsedLine.checked, text: parsedLine.text };
  });
};

export const serializeBulletItems = (items: BulletItem[]): string =>
  items.map((item) => `- ${item.text}`).join("\n");

export const updateBulletItemText = (
  items: BulletItem[],
  index: number,
  text: string,
): BulletItem[] =>
  items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, text } : item,
  );

export const splitBulletItem = (
  items: BulletItem[],
  index: number,
  leadingText: string,
): BulletItem[] => {
  if (index < 0 || index >= items.length) return items;

  const currentItem = items[index];
  const trailingText = currentItem.text.slice(leadingText.length);
  const nextItems = [...items];

  nextItems.splice(
    index,
    1,
    { ...currentItem, text: leadingText },
    { checked: false, text: trailingText },
  );
  return nextItems;
};

export const removeBulletItem = (
  items: BulletItem[],
  index: number,
): BulletItem[] => {
  if (index < 0 || index >= items.length) return items;

  return items.filter((_, itemIndex) => itemIndex !== index);
};

export const reorderBulletItem = (
  items: BulletItem[],
  fromIndex: number,
  toIndex: number,
): BulletItem[] => {
  if (fromIndex === toIndex) return items;
  if (fromIndex < 0 || fromIndex >= items.length) return items;

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  const nextIndex = Math.max(0, Math.min(toIndex, nextItems.length));

  nextItems.splice(nextIndex, 0, movedItem);
  return nextItems;
};

export const stripListSyntaxForText = (note: string): string =>
  note
    .split("\n")
    .map((line) => {
      const parsedLine = parseChecklistLine(line);
      return parsedLine.text;
    })
    .join("\n");

export const applyPlainTextToListState = (
  previousNote: string,
  plainText: string,
): string => {
  const previousItems = parseChecklistNote(previousNote);

  return serializeChecklistItems(
    plainText.split("\n").map((text, index) => ({
      checked: previousItems[index]?.checked === true,
      text,
    })),
  );
};

export const normalizeNoteForType = (
  note: string,
  noteType: NoteType,
): string => {
  if (noteType === "text") {
    return serializeChecklistItems(parseChecklistNote(note));
  }

  if (noteType === "bullet") {
    return serializeChecklistItems(parseChecklistNote(note));
  }

  return serializeChecklistItems(parseChecklistNote(note));
};
