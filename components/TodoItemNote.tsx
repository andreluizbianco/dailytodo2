import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Todo } from "../types";
import { softHaptic } from "../utils/haptics";
import { getNoteBackgroundColor, useTheme } from "../utils/theme";

interface TodoItemNoteProps {
  todo: Todo;
  updateNote: (note: string) => void;
  onStartEditing: () => void;
  onEndEditing: () => void;
}

const TodoItemNote: React.FC<TodoItemNoteProps> = ({
  todo,
  updateNote,
  onStartEditing,
  onEndEditing,
}) => {
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [localNote, setLocalNote] = useState(todo.note);

  useEffect(() => {
    setLocalNote(todo.note);
  }, [todo.note]);

  const handleChangeText = (text: string) => {
    let processedText = text;

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

  const renderNoteContent = () => {
    if (isEditing) {
      return (
        <TextInput
          autoFocus
          multiline
          value={localNote}
          onChangeText={handleChangeText}
          onBlur={handleEndEditing}
          style={[styles.noteInput, { color: theme.text }]}
          placeholderTextColor={theme.subtleText}
        />
      );
    }

    const lines = localNote.split("\n");
    return (
      <View>
        {lines.map((line, index) => {
          if (line.startsWith("[ ]") || line.startsWith("[x]")) {
            const isChecked = line.startsWith("[x]");
            return (
              <View key={index} style={styles.checkboxLine}>
                <TouchableOpacity
                  onPress={() => handleToggleCheckbox(index, lines)}
                  style={styles.checkboxTouchable}
                >
                  {isChecked ? (
                    <Text
                      style={[styles.checkmark, { color: theme.mutedText }]}
                    >
                      ✓
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
                <Text style={[styles.noteText, { color: theme.text }]}>
                  {line.substring(4)}
                </Text>
              </View>
            );
          }

          return (
            <Text key={index} style={[styles.noteText, { color: theme.text }]}>
              {line}
            </Text>
          );
        })}
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onLongPress={handleStartEditing}>
      <View
        style={[
          styles.container,
          { backgroundColor: getNoteBackgroundColor(todo.color, theme) },
        ]}
      >
        {renderNoteContent()}
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 4,
    padding: 10,
  },
  noteInput: {
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top",
  },
  noteText: {
    fontSize: 16,
    lineHeight: 24,
  },
  checkboxLine: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  checkbox: {
    width: 13,
    height: 13,
    borderWidth: 2,
    borderRadius: 4,
  },
  checkmark: {
    fontSize: 14,
    width: 13,
  },
  checkboxTouchable: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -4,
    marginRight: 4,
  },
});

export default TodoItemNote;
