import type { AmbientSoundId } from "../types";

export const ambientSoundOptions: Array<{
  id: AmbientSoundId;
  label: string;
}> = [
  {
    id: "waterfall",
    label: "Water",
  },
  {
    id: "cafe",
    label: "Cafe",
  },
  {
    id: "stream",
    label: "Stream",
  },
];

export const parseAmbientSoundId = (
  value: string | null | undefined,
): AmbientSoundId => {
  if (value === "focus") return "stream";
  if (value === "rain" || value === "gentle-rain") return "waterfall";

  return ambientSoundOptions.some((option) => option.id === value)
    ? (value as AmbientSoundId)
    : "waterfall";
};
