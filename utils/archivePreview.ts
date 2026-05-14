import {
  NoteType,
  parseBulletNote,
  parseChecklistNote,
  stripListSyntaxForText,
} from "./checklist";

export type ArchivePreviewItem =
  | { type: "text"; text: string }
  | { type: "bullet"; text: string }
  | { type: "checkbox"; text: string; checked: boolean };

export const getArchivePreviewText = (note: string): string =>
  stripListSyntaxForText(note).trim();

export const getArchivePreviewItems = (
  note: string,
  noteType: NoteType,
): ArchivePreviewItem[] => {
  if (!note.trim()) return [];

  if (noteType === "checkbox") {
    return parseChecklistNote(note).map((item) => ({
      type: "checkbox",
      text: item.text,
      checked: item.checked,
    }));
  }

  if (noteType === "bullet") {
    return parseBulletNote(note).map((item) => ({
      type: "bullet",
      text: item.text,
    }));
  }

  return getArchivePreviewText(note)
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => ({ type: "text", text: line }));
};
