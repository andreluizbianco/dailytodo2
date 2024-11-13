import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, TouchableWithoutFeedback, StyleSheet, TextInput, Text } from 'react-native';
import { Todo } from '../types';

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
  const [isEditing, setIsEditing] = useState(false);
  const [localNote, setLocalNote] = useState(todo.note);

  useEffect(() => {
    setLocalNote(todo.note);
  }, [todo.note]);

  const handleChangeText = (text: string) => {
    let processedText = text;
    
    // Check if a new line was added
    if (text.length > localNote.length && text.includes('\n', localNote.length - 1)) {
      let prefix = '';
      if (todo.noteType === 'bullet') {
        prefix = '• ';
      } else if (todo.noteType === 'checkbox') {
        prefix = '[ ] ';
      }

      // Get the text before the newline and everything after
      const insertPos = text.lastIndexOf('\n') + 1;
      processedText = text.slice(0, insertPos) + prefix + text.slice(insertPos);
    }

    setLocalNote(processedText);
    updateNote(processedText);
  };

  const handleStartEditing = () => {
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
    
    if (line.startsWith('[ ]')) {
      updatedLines[index] = line.replace('[ ]', '[x]');
    } else if (line.startsWith('[x]')) {
      updatedLines[index] = line.replace('[x]', '[ ]');
    }

    const updatedNote = updatedLines.join('\n');
    setLocalNote(updatedNote);
    updateNote(updatedNote);
  };

  const renderNoteContent = () => {
    if (isEditing) {
      return (
        <TextInput
          multiline
          value={localNote}
          onChangeText={handleChangeText}
          onBlur={handleEndEditing}
          style={styles.noteInput}
          autoFocus
        />
      );
    }

    const lines = localNote.split('\n');
    return (
      <View>
        {lines.map((line, index) => {
          if (line.startsWith('[ ]') || line.startsWith('[x]')) {
            const isChecked = line.startsWith('[x]');
            return (
              <TouchableOpacity
                key={index}
                onPress={() => handleToggleCheckbox(index, lines)}
                style={styles.checkboxLine}
              >
                <View style={styles.checkbox}>
                  {isChecked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.noteText}>{line.substring(4)}</Text>
              </TouchableOpacity>
            );
          }
          return (
            <Text key={index} style={styles.noteText}>
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
          { backgroundColor: getBackgroundColor(todo.color) },
        ]}>
        {renderNoteContent()}
      </View>
    </TouchableWithoutFeedback>
  );
};

const getBackgroundColor = (color: string): string => {
  switch (color) {
    case 'red':
      return '#fee2e2';
    case 'yellow':
      return '#fef3c7';
    case 'green':
      return '#d1fae5';
    case 'blue':
      return '#dbeafe';
    default:
      return '#f3f4f6';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 4,
    padding: 10,
  },
  noteInput: {
    fontSize: 16,
    color: '#1f2937',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  noteText: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
  },
  checkboxLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#4b5563',
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#4b5563',
    fontSize: 14,
  },
});

export default TodoItemNote;