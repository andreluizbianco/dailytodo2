import { Vibration } from 'react-native';

export const softHaptic = () => {
  Vibration.vibrate(30);
};