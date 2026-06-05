import { Todo } from "../types";

export const appendTranscriptionToNote = (
  note: string,
  text: string,
  noteType: Todo["noteType"],
) => {
  const trimmedText = text.trim();
  if (!trimmedText) return note;

  const prefix =
    noteType === "bullet" ? "- " : noteType === "checkbox" ? "[ ] " : "";
  const nextLine = `${prefix}${trimmedText}`;
  const trimmedNoteEnd = note.replace(/\s+$/u, "");

  if (!trimmedNoteEnd) return nextLine;

  return `${trimmedNoteEnd}\n${nextLine}`;
};
