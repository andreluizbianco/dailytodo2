import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type NoteType = 'text' | 'bullet' | 'checkbox';

interface NoteTypeSelectorProps {
  selectedType: NoteType;
  onSelectType: (type: NoteType) => void;
}

const NoteTypeSelector: React.FC<NoteTypeSelectorProps> = ({
  selectedType,
  onSelectType,
}) => {
  const noteTypes: NoteType[] = ['text', 'bullet', 'checkbox'];

  const renderNoteTypeButton = (type: NoteType) => {
    let content;
    switch (type) {
      case 'text':
        content = 'T';
        break;
      case 'bullet':
        content = '•';
        break;
      case 'checkbox':
        content = '☑';
        break;
    }

    return (
      <TouchableOpacity
        key={type}
        style={[
          styles.noteTypeButton,
          selectedType === type && styles.selectedNoteTypeButton,
        ]}
        onPress={() => onSelectType(type)}>
        <Text
          style={[
            styles.noteTypeButtonText,
            selectedType === type && styles.selectedNoteTypeButtonText,
          ]}>
          {content}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>{noteTypes.map(renderNoteTypeButton)}</View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  noteTypeButton: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedNoteTypeButton: {
    backgroundColor: '#4b5563',
  },
  noteTypeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4b5563',
  },
  selectedNoteTypeButtonText: {
    color: '#ffffff',
  },
});

export default NoteTypeSelector;