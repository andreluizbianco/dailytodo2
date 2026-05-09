import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../utils/theme";

type NoteType = "text" | "bullet" | "checkbox";

interface NoteTypeSelectorProps {
  selectedType: NoteType;
  onSelectType: (type: NoteType) => void;
}

const NoteTypeSelector: React.FC<NoteTypeSelectorProps> = ({
  selectedType,
  onSelectType,
}) => {
  const { theme } = useTheme();
  const noteTypes: NoteType[] = ["text", "bullet", "checkbox"];

  const renderNoteTypeButton = (type: NoteType) => {
    const content = type === "text" ? "T" : type === "bullet" ? "-" : "✓";
    const isSelected = selectedType === type;

    return (
      <TouchableOpacity
        key={type}
        style={[
          styles.noteTypeButton,
          { backgroundColor: isSelected ? theme.selected : theme.control },
        ]}
        onPress={() => onSelectType(type)}
      >
        <Text
          style={[
            styles.noteTypeButtonText,
            { color: isSelected ? theme.text : theme.mutedText },
          ]}
        >
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
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 22,
  },
  noteTypeButton: {
    width: 40,
    height: 40,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  noteTypeButtonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default NoteTypeSelector;
