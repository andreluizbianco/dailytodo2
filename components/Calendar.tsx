import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { DateData, CalendarProvider } from 'react-native-calendars';
import ExpandableCalendar from 'react-native-calendars/src/expandableCalendar';

const { width } = Dimensions.get('window');

type FontWeight = 
  | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'
  | 'normal' | 'bold' | 'ultralight' | 'light' | 'medium' | 'regular' | 'semibold' | 'thin'
  | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

interface CalendarTheme {
  backgroundColor?: string;
  calendarBackground?: string;
  textSectionTitleColor?: string;
  selectedDayBackgroundColor?: string;
  selectedDayTextColor?: string;
  todayTextColor?: string;
  dayTextColor?: string;
  textDisabledColor?: string;
  dotColor?: string;
  selectedDotColor?: string;
  arrowColor?: string;
  monthTextColor?: string;
  textMonthFontSize?: number;
  textMonthFontWeight?: FontWeight;
  textDayFontSize?: number;
  textDayHeaderFontSize?: number;
  textDayFontWeight?: FontWeight;
  textDayHeaderFontWeight?: FontWeight;
  'stylesheet.calendar.header'?: {
    week?: object;
    monthText?: object;
  };
}

const Calendar = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const events = useMemo(() => ({
    '2024-10-31': [{ title: 'Meeting' }],
    '2024-11-01': [{ title: 'Lunch' }],
    '2024-11-05': [{ title: 'Conference' }],
  }), []);

  const theme: CalendarTheme = useMemo(() => ({
    backgroundColor: '#ffffff',
    calendarBackground: '#ffffff',
    textSectionTitleColor: '#64748b',
    selectedDayBackgroundColor: '#2196F3',
    selectedDayTextColor: '#ffffff',
    todayTextColor: '#1976D2',
    dayTextColor: '#2d4150',
    textDisabledColor: '#d9e1e8',
    dotColor: '#2196F3',
    selectedDotColor: '#ffffff',
    arrowColor: '#2196F3',
    monthTextColor: '#2d4150',
    textMonthFontSize: 16,
    textMonthFontWeight: '600',
    textDayFontSize: 16,
    textDayHeaderFontSize: 14,
    textDayFontWeight: '400',
    textDayHeaderFontWeight: '600',
    'stylesheet.calendar.header': {
      week: {
        marginTop: 5,
        flexDirection: 'row',
        justifyContent: 'space-around',
      },
      monthText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937',
        paddingVertical: 4,
      },
    },
  }), []);

  const formatDate = useCallback((date: Date): string => {
    return date.toISOString().split('T')[0];
  }, []);

  const handleDateSelect = useCallback((date: DateData) => {
    setSelectedDate(new Date(date.dateString));
  }, []);

  const getMarkedDates = useCallback(() => {
    const marked: { [key: string]: any } = {};
    Object.keys(events).forEach(date => {
      marked[date] = {
        marked: true,
        dotColor: theme.dotColor,
      };
    });
    
    const formattedSelectedDate = formatDate(selectedDate);
    marked[formattedSelectedDate] = {
      ...marked[formattedSelectedDate],
      selected: true,
      selectedColor: theme.selectedDayBackgroundColor,
      selectedTextColor: theme.selectedDayTextColor,
    };
    
    return marked;
  }, [events, selectedDate, theme.dotColor, theme.selectedDayBackgroundColor, theme.selectedDayTextColor, formatDate]);

  const handleDateChanged = useCallback((date: string) => {
    setSelectedDate(new Date(date));
  }, []);

  return (
    <View style={styles.calendarWrapper}>
      <CalendarProvider
        date={formatDate(selectedDate)}
        onDateChanged={handleDateChanged}
        showTodayButton={false}
        disabledOpacity={0.6}
      >
        <ExpandableCalendar
          onDayPress={handleDateSelect}
          markedDates={getMarkedDates()}
          theme={theme}
          firstDay={1}
          calendarWidth={width - 20}
          allowShadow={false}
          hideKnob={false}
          closeOnDayPress={false}
        />
        <View style={styles.calendarContent}>
          {/* Calendar entries will go here */}
        </View>
      </CalendarProvider>
    </View>
  );
};

const styles = StyleSheet.create({
  calendarWrapper: {
    flex: 1,
    padding: 10,
    width: '100%',
  },
  calendarContent: {
    flex: 1,
    paddingTop: 20,
  },
});

export default Calendar;