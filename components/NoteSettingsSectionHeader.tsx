import React from "react";
import { StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../utils/theme";

interface NoteSettingsSectionHeaderProps {
  title: string;
  expanded: boolean;
  onPress: () => void;
  disabled?: boolean;
  enabled?: boolean;
  onToggleEnabled?: () => void;
  detail?: string;
}

const NoteSettingsSectionHeader: React.FC<NoteSettingsSectionHeaderProps> = ({
  title,
  expanded,
  onPress,
  disabled = false,
  enabled,
  onToggleEnabled,
  detail,
}) => {
  const { theme } = useTheme();
  const isDimmed = disabled || enabled === false;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.labelGroup}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.75}
      >
        <Text
          style={[
            styles.disclosureIcon,
            {
              color: isDimmed ? theme.subtleText : theme.mutedText,
              transform: [{ rotate: expanded ? "90deg" : "0deg" }],
            },
          ]}
        >
          {"\u25B8"}
        </Text>
        <Text style={[styles.label, { color: theme.text }]}>{title}</Text>
        {!!detail && (
          <Text
            numberOfLines={1}
            style={[styles.detail, { color: theme.mutedText }]}
          >
            {detail}
          </Text>
        )}
      </TouchableOpacity>

      {typeof enabled === "boolean" && onToggleEnabled ? (
        <Switch
          value={enabled}
          onValueChange={onToggleEnabled}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={theme.elevated}
        />
      ) : (
        <View style={styles.switchPlaceholder} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  labelGroup: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 8,
  },
  disclosureIcon: {
    width: 16,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    includeFontPadding: false,
    lineHeight: 16,
    marginRight: 7,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    includeFontPadding: false,
    lineHeight: 18,
  },
  detail: {
    flexShrink: 1,
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "600",
    includeFontPadding: false,
    lineHeight: 18,
  },
  switchPlaceholder: {
    width: 44,
  },
});

export default NoteSettingsSectionHeader;
