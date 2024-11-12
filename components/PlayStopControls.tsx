import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PlayStopControlsProps {
  onPlay: () => void;
  onStop: () => void;
  isPlaying?: boolean;
  disabled?: boolean;
}

const PlayStopControls: React.FC<PlayStopControlsProps> = ({
  onPlay,
  onStop,
  isPlaying = false,
  disabled = false,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          styles.playButton,
          isPlaying && styles.activeButton,
          disabled && styles.disabledButton,
        ]}
        onPress={onPlay}
        disabled={disabled || isPlaying}>
        <Ionicons
          name="play"
          size={24}
          color={disabled ? '#9CA3AF' : isPlaying ? '#ffffff' : '#2563EB'}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          styles.stopButton,
          !isPlaying && styles.disabledButton,
        ]}
        onPress={onStop}
        disabled={disabled || !isPlaying}>
        <Ionicons
          name="stop"
          size={24}
          color={disabled || !isPlaying ? '#9CA3AF' : '#EF4444'}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 42,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  playButton: {
    borderColor: '#2563EB',
  },
  stopButton: {
    borderColor: '#EF4444',
  },
  activeButton: {
    backgroundColor: '#2563EB',
  },
  disabledButton: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    opacity: 0.5,
  },
});

export default PlayStopControls;