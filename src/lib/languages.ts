const languages = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "pl",
  "tr",
  "ru",
  "nl",
  "cs",
  "ar",
  "zh",
  "hu",
  "ko",
  "hi",
] as const;

export type Language = (typeof languages)[number];
export default languages;
