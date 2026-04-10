export const FILTER_PRESETS = {
  'ages-4-6': {
    name: 'Little Kids (4-6)',
    maxLanguageScore: 1,
    maxViolenceScore: 1,
    maxSexualContentScore: 0,
    maxScaryScore: 1,
    maxMpaa: 'G',
  },
  'ages-7-9': {
    name: 'Kids (7-9)',
    maxLanguageScore: 2,
    maxViolenceScore: 2,
    maxSexualContentScore: 1,
    maxScaryScore: 2,
    maxMpaa: 'PG',
  },
  'ages-10-12': {
    name: 'Tweens (10-12)',
    maxLanguageScore: 3,
    maxViolenceScore: 3,
    maxSexualContentScore: 1,
    maxScaryScore: 3,
    maxMpaa: 'PG-13',
  },
  'family-night': {
    name: 'Family Movie Night',
    maxLanguageScore: 1,
    maxViolenceScore: 2,
    maxSexualContentScore: 0,
    maxScaryScore: 2,
    maxMpaa: 'PG',
  },
} as const;

export type FilterPresetKey = keyof typeof FILTER_PRESETS;

export const DEFAULT_BLOCKED_WORDS = ['f-word', 's-word', 'ass', 'bastard'];
