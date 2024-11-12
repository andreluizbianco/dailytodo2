import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

interface TimeWheelPickerProps {
  initialHours: string;
  initialMinutes: string;
  onTimeChange?: (hours: string, minutes: string) => void;
  itemHeight?: number;
  visibleItems?: number;
  fontSize?: number;
  selectedFontSize?: number;
  textColor?: string;
  selectedTextColor?: string;
}

const TimeWheelPicker: React.FC<TimeWheelPickerProps> = ({
  initialHours = '00',
  initialMinutes = '00',
  onTimeChange,
  itemHeight = 40,
  visibleItems = 3,
  fontSize = 16,
  selectedFontSize = 20,
  textColor = '#000000',
  selectedTextColor = '#000000',
}) => {
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTimeChange = useCallback((hours: string, minutes: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      onTimeChange?.(hours, minutes);
    }, 400);
  }, [onTimeChange]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const WheelPicker = ({ 
    values, 
    initialValue, 
    onValueChange 
  }: { 
    values: string[],
    initialValue: string,
    onValueChange: (value: string) => void 
  }) => {
    const [currentCenterIndex, setCurrentCenterIndex] = useState(values.indexOf(initialValue));
    const scrollViewRef = useRef<ScrollView>(null);
    const currentValueRef = useRef(initialValue);

    useEffect(() => {
      const initialIndex = values.indexOf(initialValue);
      if (initialIndex !== -1 && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({
          y: initialIndex * itemHeight,
          animated: false,
        });
        setCurrentCenterIndex(initialIndex);
        currentValueRef.current = initialValue;
      }
    }, []);

    const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / itemHeight);
      if (index !== currentCenterIndex) {
        setCurrentCenterIndex(index);
        currentValueRef.current = values[index];
        onValueChange(values[index]);
      }
    }, [currentCenterIndex, onValueChange, values]);

    const getItemStyle = (index: number) => {
      const relativeIndex = index - currentCenterIndex;
      const defaultStyle = {
        fontSize: fontSize,
        color: textColor,
      };

      if (relativeIndex === 0) {
        return {
          fontSize: selectedFontSize,
          fontWeight: 'bold' as const,
          color: selectedTextColor,
        };
      } else {
        const opacity = Math.max(0.3, 1 - Math.abs(relativeIndex) * 0.7);
        return {
          ...defaultStyle,
          opacity,
        };
      }
    };

    return (
      <View style={[styles.wheelContainer, { height: itemHeight * visibleItems }]}>
        <View
          style={[
            styles.selectionOverlay,
            {
              top: itemHeight,
              height: itemHeight,
            },
          ]}
          pointerEvents="none"
        />
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingVertical: itemHeight * Math.floor(visibleItems / 2),
          }}>
          {values.map((value, index) => (
            <View
              key={index}
              style={[styles.itemContainer, { height: itemHeight }]}>
              <Text style={getItemStyle(index)}>{value}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const handleHoursChange = useCallback((value: string) => {
    handleTimeChange(value, initialMinutes);
  }, [handleTimeChange, initialMinutes]);

  const handleMinutesChange = useCallback((value: string) => {
    handleTimeChange(initialHours, value);
  }, [handleTimeChange, initialHours]);

  return (
    <View style={styles.container}>
      <WheelPicker
        values={hours}
        initialValue={initialHours}
        onValueChange={handleHoursChange}
      />
      <Text style={styles.separator}>:</Text>
      <WheelPicker
        values={minutes}
        initialValue={initialMinutes}
        onValueChange={handleMinutesChange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelContainer: {
    width: 70,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  itemContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  separator: {
    fontSize: 24,
    marginHorizontal: 10,
    color: '#000000',
  },
});

export default React.memo(TimeWheelPicker);