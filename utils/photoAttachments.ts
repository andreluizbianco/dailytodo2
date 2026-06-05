import { NotePhotoAttachment, Todo } from "../types";

export const appendPhotoAttachment = (
  todo: Pick<Todo, "attachments">,
  attachment: Omit<NotePhotoAttachment, "type"> &
    Partial<Pick<NotePhotoAttachment, "type">>,
) => ({
  ...todo,
  attachments: [
    ...(todo.attachments ?? []),
    {
      ...attachment,
      type: "image" as const,
    },
  ],
});

export const removePhotoAttachment = (
  todo: Pick<Todo, "attachments">,
  attachmentId: string,
) => ({
  ...todo,
  attachments: (todo.attachments ?? []).filter(
    (attachment) => attachment.id !== attachmentId,
  ),
});
