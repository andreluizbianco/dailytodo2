import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../utils/theme";

type NoteType = "text" | "bullet" | "checkbox";

interface NoteTypeSelectorProps {
  selectedType: NoteType;
  checkboxBehavior?: "simple" | "completion";
  onSelectType: (type: NoteType) => void;
  onLongSelectType?: (type: NoteType) => void;
}

const NoteTypeSelector: React.FC<NoteTypeSelectorProps> = ({
  selectedType,
  checkboxBehavior = "simple",
  onSelectType,
  onLongSelectType,
}) => {
  const { theme } = useTheme();
  const noteTypes: NoteType[] = ["text", "bullet", "checkbox"];

  const renderNoteTypeButton = (type: NoteType) => {
    const content =
      type === "text" ? "T" : type === "bullet" ? "\u2022" : "\u2713";
    const isSelected = selectedType === type;

    return (
      <TouchableOpacity
        key={type}
        style={[
          styles.noteTypeButton,
          {
            backgroundColor: theme.control,
            borderColor: isSelected ? theme.text : "transparent",
          },
        ]}
        onPress={() => onSelectType(type)}
        onLongPress={() => onLongSelectType?.(type)}
        delayLongPress={450}
        activeOpacity={0.75}
      >
        {type === "checkbox" &&
        isSelected &&
        checkboxBehavior === "completion" ? (
          <View style={styles.struckCheckWrap}>
            <Text
              style={[
                styles.noteTypeButtonText,
                { color: theme.text, opacity: 1 },
              ]}
            >
              {content}
            </Text>
            <View style={[styles.strikeLine, { backgroundColor: theme.text }]} />
          </View>
        ) : (
          <Text
            style={[
              styles.noteTypeButtonText,
              {
                color: isSelected ? theme.text : theme.mutedText,
                opacity: isSelected ? 1 : 0.78,
              },
            ]}
          >
            {content}
          </Text>
        )}
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
    borderRadius: 5,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  noteTypeButtonText: {
    fontSize: 18,
    fontWeight: "700",
  },
  struckCheckWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  strikeLine: {
    position: "absolute",
    width: 22,
    height: 2,
    transform: [{ rotate: "-18deg" }],
  },
});

export default NoteTypeSelector;
