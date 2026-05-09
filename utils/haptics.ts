import { Vibration } from "react-native";

export const softHaptic = () => {
  Vibration.vibrate(55);
};

export const withLongPressHaptic =
  <TArgs extends unknown[]>(handler: (...args: TArgs) => void) =>
  (...args: TArgs) => {
    softHaptic();
    handler(...args);
  };
