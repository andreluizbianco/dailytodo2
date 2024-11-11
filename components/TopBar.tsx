import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ViewType = 'notes' | 'settings' | 'archive' | 'calendar';

interface TopBarProps {
  onAddTodo: () => void;
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
}

const TopBar: React.FC<TopBarProps> = ({ 
  onAddTodo, 
  activeView, 
  setActiveView, 
  showSettings, 
  setShowSettings 
}) => {
  const handleNotesPress = () => {
    if (activeView !== 'notes') {
      setActiveView('notes');
      setShowSettings(false);
    } else {
      setShowSettings(!showSettings);
    }
  };

  const handleTimerPress = () => {
    setActiveView('settings');
  };

  const handleTimerLongPress = () => {
    setActiveView('calendar');
  };

  return (
    <View style={styles.container}>
      <View style={styles.addButtonSection}>
        <TouchableOpacity onPress={onAddTodo} style={styles.addButton}>
          <View style={styles.plusIcon}>
            <View style={styles.plusIconHorizontal} />
            <View style={styles.plusIconVertical} />
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.iconsSection}>
        <TouchableOpacity onPress={handleNotesPress} style={styles.iconButton}>
          <Ionicons
            name="document-text"
            size={28}
            color={activeView === 'notes' ? '#3b82f6' : '#6b7280'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleTimerPress}
          onLongPress={handleTimerLongPress}
          delayLongPress={500}
          style={styles.iconButton}
        >
          <Ionicons
            name="time"
            size={28}
            color={activeView === 'settings' || activeView === 'calendar' ? '#3b82f6' : '#6b7280'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveView('archive')}
          style={styles.iconButton}
        >
          <Ionicons
            name="archive"
            size={28}
            color={activeView === 'archive' ? '#3b82f6' : '#6b7280'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingTop: 8,
  },
  addButtonSection: {
    width: '40%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  iconsSection: {
    width: '60%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  addButton: {
    backgroundColor: '#2563eb',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: {
    width: 20,
    height: 20,
  },
  plusIconHorizontal: {
    position: 'absolute',
    backgroundColor: 'white',
    width: 20,
    height: 2,
    top: 9,
  },
  plusIconVertical: {
    position: 'absolute',
    backgroundColor: 'white',
    width: 2,
    height: 20,
    left: 9,
  },
  iconButton: {
    padding: 10,
    marginHorizontal: 5,
  },
});

export default TopBar;