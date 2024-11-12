import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, TextInput, Text } from 'react-native';
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

  useEffect(() => {
    setIsEditing(false);
  }, [todo.id]);

  const handleStartEditing = () => {
    setIsEditing(true);
    onStartEditing();
  };

  const handleEndEditing = () => {
    setIsEditing(false);
    onEndEditing();
  };

  const handleChangeText = (text: string) => {
    setLocalNote(text);
    updateNote(text);
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

    return (
      <Text style={styles.noteText}>
        {localNote || 'Long press to add a note...'}
      </Text>
    );
  };

  const getBackgroundColor = () => {
    switch (todo.color) {
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

  return (
    <TouchableOpacity
      onLongPress={handleStartEditing}
      style={[styles.container, { backgroundColor: getBackgroundColor() }]}
    >
      {renderNoteContent()}
    </TouchableOpacity>
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
    color: '#1f2937',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  noteText: {
    fontSize: 16,
    color: '#1f2937',
    minHeight: 100,
  },
});

export default TodoItemNote;