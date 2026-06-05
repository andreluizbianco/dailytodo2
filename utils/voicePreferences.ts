import { VoiceLanguagePreference } from "../types";

export const DEFAULT_VOICE_LANGUAGE: VoiceLanguagePreference = "system";

export const voiceLanguageOptions: Array<{
  label: string;
  value: VoiceLanguagePreference;
}> = [
  { label: "System", value: "system" },
  { label: "PT-PT", value: "pt-PT" },
  { label: "PT-BR", value: "pt-BR" },
  { label: "EN-US", value: "en-US" },
  { label: "EN-GB", value: "en-GB" },
  { label: "DE", value: "de-DE" },
  { label: "FR", value: "fr-FR" },
  { label: "ES", value: "es-ES" },
  { label: "IT", value: "it-IT" },
];

export const isVoiceLanguagePreference = (
  value: unknown,
): value is VoiceLanguagePreference =>
  voiceLanguageOptions.some((option) => option.value === value);

export const getNativeVoiceLanguageTag = (
  preference: VoiceLanguagePreference,
) => (preference === "system" ? null : preference);
