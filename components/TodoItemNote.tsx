import React, { ReactNode, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Todo } from "../types";
import {
  BulletItem,
  applyPlainTextToListState,
  ChecklistItem,
  normalizeChecklistItems,
  parseBulletNote,
  parseChecklistNote,
  removeBulletItem,
  removeChecklistItem,
  reorderBulletItem,
  reorderChecklistItem,
  serializeBulletItems,
  serializeChecklistItems,
  splitBulletItem,
  splitChecklistItem,
  stripListSyntaxForText,
  toggleChecklistItem,
  updateBulletItemText,
  updateChecklistItemText,
} from "../utils/checklist";
import { softHaptic } from "../utils/haptics";
import { getNoteBackgroundColor, useTheme } from "../utils/theme";

interface TodoItemNoteProps {
  todo: Todo;
  headerRight?: ReactNode;
  footerRight?: ReactNode;
  disableShadow?: boolean;
  photoAttachmentsEnabled?: boolean;
  photoScanEnabled?: boolean;
  showTitle?: boolean;
  titleSize?: number;
  onRemovePhotoAttachment?: (attachmentId: string) => void;
  onScanPhotoAttachment?: (attachmentId: string) => void;
  updateNote: (note: string) => void;
  onStartEditing: () => void;
  onEndEditing: () => void;
  onListDragChange?: (isDragging: boolean) => void;
  onListDragMove?: (pageY: number) => number;
}

const TodoItemNote: React.FC<TodoItemNoteProps> = ({
  todo,
  headerRight,
  footerRight,
  disableShadow = false,
  photoAttachmentsEnabled = true,
  photoScanEnabled = false,
  showTitle = false,
  titleSize,
  onRemovePhotoAttachment,
  onScanPhotoAttachment,
  updateNote,
  onStartEditing,
  onEndEditing,
  onListDragChange,
  onListDragMove,
}) => {
  const { noteBodyFontSize, noteListSpacing, theme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [localNote, setLocalNote] = useState(todo.note);
  const inputRef = useRef<TextInput>(null);
  const checklistInputRefs = useRef<Record<number, TextInput | null>>({});
  const checklistDragStartIndex = useRef<number | null>(null);
  const checklistDragTargetIndex = useRef<number | null>(null);
  const checklistTouchStartIndex = useRef<number | null>(null);
  const checklistTouchStartY = useRef(0);
  const checklistDragScrollDelta = useRef(0);
  const checklistPanY = useRef(new Animated.Value(0)).current;
  const checklistItemAnimations = useRef<Record<number, Animated.Value>>({});
  const checklistRowHeights = useRef<Record<number, number>>({});
  const checklistLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const checklistDidDrag = useRef(false);
  const checklistSuppressToggle = useRef(false);
  const [liftedChecklistIndex, setLiftedChecklistIndex] = useState<
    number | null
  >(null);
  const titleText = todo.text.trim() || "Untitled";
  const isInteractiveList =
    todo.noteType === "checkbox" || todo.noteType === "bullet";
  const isCompletionChecklist =
    todo.noteType === "checkbox" && todo.checkboxBehavior === "completion";
  const listRowGap = Math.round((noteListSpacing - 1) * 5);
  const visiblePhotoAttachments = photoAttachmentsEnabled
    ? (todo.attachments ?? []).filter((attachment) => attachment.type === "image")
    : [];

  useEffect(() => {
    setLocalNote(todo.note);
  }, [todo.note]);

  useEffect(() => {
    setIsEditing(false);
    onEndEditing();
    checklistInputRefs.current = {};
    checklistRowHeights.current = {};
    checklistItemAnimations.current = {};
    checklistDragStartIndex.current = null;
    checklistDragTargetIndex.current = null;
    checklistTouchStartIndex.current = null;
    checklistDragScrollDelta.current = 0;
    checklistPanY.setValue(0);
    setLiftedChecklistIndex(null);
  }, [todo.id]);

  useEffect(() => {
    checklistRowHeights.current = {};
    Object.values(checklistItemAnimations.current).forEach((animation) => {
      animation.setValue(0);
    });
  }, [todo.noteType, localNote, noteBodyFontSize, noteListSpacing]);

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isEditing]);

  useEffect(
    () => () => {
      if (checklistLongPressTimer.current) {
        clearTimeout(checklistLongPressTimer.current);
      }
    },
    [],
  );

  const handleChangeText = (text: string) => {
    let processedText =
      todo.noteType === "text"
        ? applyPlainTextToListState(localNote, text)
        : text;

    if (
      text.length > localNote.length &&
      text.includes("\n", localNote.length - 1)
    ) {
      let prefix = "";
      if (todo.noteType === "bullet") {
        prefix = "- ";
      } else if (todo.noteType === "checkbox") {
        prefix = "[ ] ";
      }

      const insertPos = text.lastIndexOf("\n") + 1;
      processedText = text.slice(0, insertPos) + prefix + text.slice(insertPos);
    }

    setLocalNote(processedText);
    updateNote(processedText);
  };

  const handleStartEditing = () => {
    softHaptic();
    setIsEditing(true);
    onStartEditing();
  };

  const handleEndEditing = () => {
    setIsEditing(false);
    onEndEditing();
  };

  const handleToggleCheckbox = (index: number, lines: string[]) => {
    if (isEditing) return;

    const updatedLines = [...lines];
    const line = updatedLines[index];

    if (line.startsWith("[ ]")) {
      updatedLines[index] = line.replace("[ ]", "[x]");
    } else if (line.startsWith("[x]")) {
      updatedLines[index] = line.replace("[x]", "[ ]");
    }

    const updatedNote = updatedLines.join("\n");
    setLocalNote(updatedNote);
    updateNote(updatedNote);
  };

  const toChecklistItems = (
    items: Array<ChecklistItem | BulletItem>,
  ): ChecklistItem[] =>
    items.map((item) => ({
      checked: "checked" in item && item.checked === true,
      text: item.text,
    }));

  const toBulletItems = (
    items: Array<ChecklistItem | BulletItem>,
  ): BulletItem[] =>
    items.map((item) => ({
      checked: "checked" in item && item.checked === true,
      text: item.text,
    }));

  const saveChecklistItems = (items: Array<ChecklistItem | BulletItem>) => {
    const serializedNote = serializeChecklistItems(toChecklistItems(items));
    setLocalNote(serializedNote);
    updateNote(serializedNote);
  };

  const getChecklistItems = () => {
    const items =
      todo.noteType === "checkbox"
        ? isCompletionChecklist
          ? normalizeChecklistItems(parseChecklistNote(localNote))
          : parseChecklistNote(localNote)
        : parseBulletNote(localNote);
    return items.length > 0 ? items : [{ checked: false, text: "" }];
  };

  const handleChecklistTextChange = (index: number, text: string) => {
    if (text.includes("\n")) {
      const [leadingText, ...restLines] = text.split("\n");
      const items = getChecklistItems();
      const nextItems =
        todo.noteType === "checkbox"
          ? splitChecklistItem(
              toChecklistItems(items),
              index,
              leadingText,
              isCompletionChecklist,
            )
          : splitBulletItem(toBulletItems(items), index, leadingText);
      const createdIndex = index + 1;
      const trailingText = restLines.join(" ").trimStart();

      if (trailingText) {
        nextItems[createdIndex] = {
          ...nextItems[createdIndex],
          text: trailingText,
        };
      }

      saveChecklistItems(nextItems);
      setTimeout(() => checklistInputRefs.current[createdIndex]?.focus(), 30);
      return;
    }

    const items = getChecklistItems();
    saveChecklistItems(
      todo.noteType === "checkbox"
        ? updateChecklistItemText(toChecklistItems(items), index, text)
        : updateBulletItemText(toBulletItems(items), index, text),
    );
  };

  const handleChecklistSubmit = (index: number) => {
    const items = getChecklistItems();
    const nextItems =
      todo.noteType === "checkbox"
        ? splitChecklistItem(
            toChecklistItems(items),
            index,
            items[index]?.text ?? "",
            isCompletionChecklist,
          )
        : splitBulletItem(toBulletItems(items), index, items[index]?.text ?? "");

    saveChecklistItems(nextItems);
    setTimeout(() => checklistInputRefs.current[index + 1]?.focus(), 30);
  };

  const handleChecklistBackspace = (index: number) => {
    const items = getChecklistItems();
    const item = items[index];

    if (!item || item.text.length > 0 || items.length <= 1) return;

    const previousIndex = Math.max(0, index - 1);
    checklistInputRefs.current[previousIndex]?.focus();
    saveChecklistItems(
      todo.noteType === "checkbox"
        ? removeChecklistItem(toChecklistItems(items), index)
        : removeBulletItem(toBulletItems(items), index),
    );
    setTimeout(() => {
      checklistInputRefs.current[previousIndex]?.focus();
    }, 0);
  };

  const handleChecklistToggle = (index: number) => {
    if (liftedChecklistIndex !== null) return;

    softHaptic();
    saveChecklistItems(
      toggleChecklistItem(
        toChecklistItems(getChecklistItems()),
        index,
        isCompletionChecklist,
      ),
    );
  };

  const getChecklistDragTargetIndex = (
    startIndex: number,
    dy: number,
    itemCount: number,
  ) => {
    if (dy === 0) return startIndex;

    if (dy > 0) {
      let distance = 0;
      for (let itemIndex = startIndex + 1; itemIndex < itemCount; itemIndex += 1) {
        const rowHeight =
          checklistRowHeights.current[itemIndex] ?? CHECKLIST_ROW_HEIGHT;
        if (dy < distance + rowHeight / 2) return itemIndex - 1;
        distance += rowHeight;
      }
      return itemCount - 1;
    }

    let distance = 0;
    for (let itemIndex = startIndex - 1; itemIndex >= 0; itemIndex -= 1) {
      const rowHeight =
        checklistRowHeights.current[itemIndex] ?? CHECKLIST_ROW_HEIGHT;
      if (Math.abs(dy) < distance + rowHeight / 2) return itemIndex + 1;
      distance += rowHeight;
    }
    return 0;
  };

  const reorderChecklistByOffset = (dy: number) => {
    const startIndex = checklistDragStartIndex.current;
    if (startIndex === null) return;

    checklistDidDrag.current = true;

    const items = getChecklistItems();
    const targetIndex = getChecklistDragTargetIndex(
      startIndex,
      dy,
      items.length,
    );
    const draggedRowHeight =
      checklistRowHeights.current[startIndex] ?? CHECKLIST_ROW_HEIGHT;

    checklistPanY.setValue(dy);
    checklistDragTargetIndex.current = targetIndex;

    items.forEach((_, itemIndex) => {
      const animation = checklistItemAnimations.current[itemIndex];
      if (!animation || itemIndex === startIndex) return;

      let targetOffset = 0;
      if (itemIndex > startIndex && itemIndex <= targetIndex) {
        targetOffset = -draggedRowHeight;
      } else if (itemIndex < startIndex && itemIndex >= targetIndex) {
        targetOffset = draggedRowHeight;
      }

      Animated.spring(animation, {
        toValue: targetOffset,
        useNativeDriver: true,
        friction: 7,
        tension: 240,
      }).start();
    });
  };

  const finishChecklistDrag = () => {
    if (checklistDragStartIndex.current !== null) {
      const targetIndex =
        checklistDragTargetIndex.current ?? checklistDragStartIndex.current;

      saveChecklistItems(
        todo.noteType === "checkbox"
          ? reorderChecklistItem(
              toChecklistItems(getChecklistItems()),
              checklistDragStartIndex.current,
              targetIndex,
              isCompletionChecklist,
            )
          : reorderBulletItem(
              toBulletItems(getChecklistItems()),
              checklistDragStartIndex.current,
              targetIndex,
            ),
      );
    }

    checklistDragStartIndex.current = null;
    checklistDragTargetIndex.current = null;
    checklistDragScrollDelta.current = 0;
    onListDragChange?.(false);
    setLiftedChecklistIndex(null);
    checklistPanY.setValue(0);

    Object.values(checklistItemAnimations.current).forEach((animation) => {
      animation.setValue(0);
    });
  };

  const startChecklistLongPress = (index: number, pageY: number) => {
    checklistDidDrag.current = false;
    checklistTouchStartIndex.current = index;
    checklistTouchStartY.current = pageY;
    checklistDragScrollDelta.current = 0;

    if (checklistLongPressTimer.current) {
      clearTimeout(checklistLongPressTimer.current);
    }

    checklistLongPressTimer.current = setTimeout(() => {
      softHaptic();
      checklistSuppressToggle.current = true;
      checklistDragStartIndex.current = index;
      checklistDragTargetIndex.current = index;
      onListDragChange?.(true);
      setLiftedChecklistIndex(index);
    }, 260);
  };

  const clearChecklistLongPress = () => {
    if (!checklistLongPressTimer.current) return;

    clearTimeout(checklistLongPressTimer.current);
    checklistLongPressTimer.current = null;
  };

  const handleChecklistRowTouchMove = (pageY: number) => {
    const dy = pageY - checklistTouchStartY.current;

    if (checklistDragStartIndex.current !== null) {
      checklistDragScrollDelta.current += onListDragMove?.(pageY) ?? 0;
      reorderChecklistByOffset(dy + checklistDragScrollDelta.current);
      return;
    }

    if (Math.abs(dy) > 8) {
      clearChecklistLongPress();
    }
  };

  const handleChecklistRowTouchEnd = () => {
    clearChecklistLongPress();
    checklistTouchStartIndex.current = null;

    if (checklistDragStartIndex.current !== null) {
      finishChecklistDrag();
    }

    setTimeout(() => {
      checklistSuppressToggle.current = false;
    }, 80);
  };

  const renderChecklistContent = () => {
    const checklistItems = getChecklistItems();
    const isCheckboxList = todo.noteType === "checkbox";

    return (
      <View>
        {checklistItems.map((item, index) => {
          if (!checklistItemAnimations.current[index]) {
            checklistItemAnimations.current[index] = new Animated.Value(0);
          }

          const isChecked = "checked" in item && item.checked;
          const isLifted = liftedChecklistIndex === index;
          const rowTransform = isLifted
            ? [{ translateY: checklistPanY }, { scale: 1.015 }]
            : [{ translateY: checklistItemAnimations.current[index] }];

          return (
            <Animated.View
              key={
                isCompletionChecklist
                  ? `${todo.id}-${index}-${isChecked ? "checked" : "open"}`
                  : `${todo.id}-${todo.noteType}-${index}`
              }
              onLayout={({ nativeEvent }) => {
                checklistRowHeights.current[index] = nativeEvent.layout.height;
              }}
              onTouchStart={({ nativeEvent }) => {
                startChecklistLongPress(index, nativeEvent.pageY);
              }}
              onTouchMove={({ nativeEvent }) => {
                handleChecklistRowTouchMove(nativeEvent.pageY);
              }}
              onTouchEnd={handleChecklistRowTouchEnd}
              onTouchCancel={handleChecklistRowTouchEnd}
              onMoveShouldSetResponderCapture={() =>
                checklistDragStartIndex.current === index
              }
              onResponderMove={({ nativeEvent }) => {
                handleChecklistRowTouchMove(nativeEvent.pageY);
              }}
              onResponderRelease={handleChecklistRowTouchEnd}
              onResponderTerminate={handleChecklistRowTouchEnd}
              style={[
                styles.checklistRow,
                { marginBottom: listRowGap },
                { transform: rowTransform },
                isLifted && [
                  styles.checklistRowLifted,
                  {
                    backgroundColor: getNoteBackgroundColor(todo.color, theme),
                  },
                ],
              ]}
            >
              {isCheckboxList ? (
                <TouchableOpacity
                  activeOpacity={0.82}
                  hitSlop={{ top: 10, bottom: 10, left: 14, right: 12 }}
                  onPress={() => {
                    if (checklistSuppressToggle.current) {
                      checklistSuppressToggle.current = false;
                      return;
                    }

                    handleChecklistToggle(index);
                  }}
                  style={[
                    styles.robustCheckbox,
                    {
                      borderColor: isChecked ? theme.mutedText : theme.text,
                      backgroundColor: isChecked
                        ? theme.mutedText
                        : "transparent",
                    },
                  ]}
                >
                  {isChecked && (
                    <Ionicons
                      name="checkmark"
                      size={12}
                      color={theme.elevated}
                    />
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.bulletIconWrap}>
                  <View
                    style={[
                      styles.bulletIcon,
                      { backgroundColor: theme.mutedText },
                    ]}
                  />
                </View>
              )}
              <TextInput
                ref={(ref) => {
                  checklistInputRefs.current[index] = ref;
                }}
                value={item.text}
                onFocus={onStartEditing}
                onBlur={onEndEditing}
                multiline
                scrollEnabled={false}
                blurOnSubmit={false}
                onChangeText={(text) => handleChecklistTextChange(index, text)}
                onSubmitEditing={() => handleChecklistSubmit(index)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === "Backspace") {
                    handleChecklistBackspace(index);
                  }
                }}
                style={[
                  styles.checklistInput,
                  {
                    color:
                      isCheckboxList && isCompletionChecklist && isChecked
                        ? theme.mutedText
                        : theme.text,
                    fontSize: noteBodyFontSize,
                    lineHeight: Math.round(noteBodyFontSize * 1.45),
                    textDecorationLine:
                      isCheckboxList && isCompletionChecklist && isChecked
                        ? "line-through"
                        : "none",
                  },
                ]}
              />
            </Animated.View>
          );
        })}
      </View>
    );
  };

  const renderNoteContent = () => {
    if (isEditing) {
      return (
        <TextInput
          ref={inputRef}
          multiline
          value={
            todo.noteType === "text"
              ? stripListSyntaxForText(localNote)
              : localNote
          }
          onChangeText={handleChangeText}
          onBlur={handleEndEditing}
          style={[
            styles.noteInput,
            {
              color: theme.text,
              fontSize: noteBodyFontSize,
              lineHeight: Math.round(noteBodyFontSize * 1.5),
            },
          ]}
          placeholderTextColor={theme.subtleText}
        />
      );
    }

    const noteText =
      todo.noteType === "text" ? stripListSyntaxForText(localNote) : localNote;
    const lines = noteText.split("\n");
    return (
      <View>
        {lines.map((line, index) => {
          if (line.startsWith("[ ]") || line.startsWith("[x]")) {
            const isChecked = line.startsWith("[x]");
            return (
              <View key={index} style={styles.checkboxLine}>
                <TouchableOpacity
                  onPress={() => handleToggleCheckbox(index, lines)}
                  style={[
                    styles.checkboxTouchable,
                    {
                      height: Math.round(noteBodyFontSize * 1.5),
                      paddingTop: Math.max(1, noteBodyFontSize * 0.18),
                    },
                  ]}
                  hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
                >
                  {isChecked ? (
                    <Text
                      style={[
                        styles.checkmark,
                        {
                          color: theme.mutedText,
                          fontSize: Math.max(13, noteBodyFontSize * 0.78),
                        },
                      ]}
                    >
                      {"\u2713"}
                    </Text>
                  ) : (
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: theme.mutedText },
                      ]}
                    />
                  )}
                </TouchableOpacity>
                <Text
                  android_hyphenationFrequency="normal"
                  textBreakStrategy="highQuality"
                  style={[
                    styles.noteText,
                    {
                      color: theme.text,
                      fontSize: noteBodyFontSize,
                      lineHeight: Math.round(noteBodyFontSize * 1.5),
                    },
                  ]}
                >
                  {line.substring(4)}
                </Text>
              </View>
            );
          }

          return (
            <Text
              key={index}
              android_hyphenationFrequency="normal"
              textBreakStrategy="highQuality"
              style={[
                styles.noteText,
                {
                  color: theme.text,
                  fontSize: noteBodyFontSize,
                  lineHeight: Math.round(noteBodyFontSize * 1.5),
                },
              ]}
            >
              {line}
            </Text>
          );
        })}
      </View>
    );
  };

  const noteBody = (
    <View
      style={[
        styles.container,
        { backgroundColor: getNoteBackgroundColor(todo.color, theme) },
        footerRight && !localNote.trim()
          ? { minHeight: Math.round(noteBodyFontSize * 3.2) }
          : null,
        disableShadow ? styles.noShadow : null,
      ]}
    >
      {showTitle && (
        <View style={styles.noteTitleRow}>
          <Text
            style={[
              styles.noteTitle,
              { color: theme.text },
              titleSize ? { fontSize: titleSize } : null,
            ]}
          >
            {titleText}
          </Text>
          {headerRight ? (
            <View style={styles.noteTitleActions}>{headerRight}</View>
          ) : null}
        </View>
      )}
      {isInteractiveList
        ? renderChecklistContent()
        : renderNoteContent()}
      {visiblePhotoAttachments.length > 0 ? (
        <View style={styles.photoAttachmentGrid}>
          {visiblePhotoAttachments.map((attachment) => (
            <TouchableOpacity
              key={attachment.id}
              activeOpacity={0.82}
              delayLongPress={700}
              onLongPress={() => onRemovePhotoAttachment?.(attachment.id)}
              style={[styles.photoAttachment, { borderColor: theme.border }]}
            >
              <Image
                source={{ uri: attachment.uri }}
                style={styles.photoAttachmentImage}
              />
              {photoScanEnabled && onScanPhotoAttachment ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => onScanPhotoAttachment(attachment.id)}
                  style={[
                    styles.photoScanButton,
                    { backgroundColor: theme.elevated, borderColor: theme.border },
                  ]}
                >
                  <Ionicons
                    name="scan-outline"
                    size={15}
                    color={theme.mutedText}
                  />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {footerRight ? <View style={styles.noteFooter}>{footerRight}</View> : null}
    </View>
  );

  if (isInteractiveList) {
    return noteBody;
  }

  return (
    <TouchableWithoutFeedback onLongPress={handleStartEditing}>
      {noteBody}
    </TouchableWithoutFeedback>
  );
};

const CHECKLIST_ROW_HEIGHT = 34;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 6,
    padding: 10,
    ...Platform.select({
      android: {
        elevation: 1.4,
      },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.075,
        shadowRadius: 2.4,
      },
    }),
  },
  noShadow: {
    borderRadius: 4,
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  noteTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
  },
  noteTitleActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  noteTitleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  noteInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 24,
    padding: 0,
    margin: 0,
    textAlignVertical: "top",
  },
  noteFooter: {
    alignItems: "flex-end",
    marginTop: 6,
  },
  photoAttachmentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  photoAttachment: {
    borderRadius: 6,
    borderWidth: 1,
    height: 74,
    overflow: "hidden",
    position: "relative",
    width: 74,
  },
  photoAttachmentImage: {
    height: "100%",
    width: "100%",
  },
  photoScanButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    bottom: 4,
    height: 25,
    justifyContent: "center",
    position: "absolute",
    right: 4,
    width: 25,
  },
  noteText: {
    fontSize: 16,
    lineHeight: 24,
    alignSelf: "stretch",
    flexShrink: 1,
    width: "100%",
  },
  checklistRow: {
    minHeight: CHECKLIST_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 0,
  },
  checklistRowLifted: {
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  robustCheckbox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 0,
    marginRight: 12,
    marginTop: 9,
  },
  bulletIconWrap: {
    width: 14,
    minHeight: CHECKLIST_ROW_HEIGHT,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 13,
    marginLeft: 0,
    marginRight: 5,
  },
  bulletIcon: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  checklistInput: {
    flex: 1,
    minHeight: CHECKLIST_ROW_HEIGHT,
    paddingVertical: 3,
    paddingHorizontal: 0,
    textAlignVertical: "top",
  },
  checkboxLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 2,
  },
  checkbox: {
    width: 13,
    height: 13,
    borderWidth: 2,
    borderRadius: 4,
  },
  checkmark: {
    lineHeight: 14,
    width: 13,
    textAlign: "center",
    includeFontPadding: false,
  },
  checkboxTouchable: {
    width: 34,
    justifyContent: "flex-start",
    alignItems: "center",
    marginLeft: -8,
    marginRight: 10,
  },
});

export default TodoItemNote;
