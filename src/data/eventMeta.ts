// Hand-authored event metadata sourced from 00_NSDA_Judge_Quick_Reference.md:
// short codes, category grouping, and a one-line judging mindset per category.
// The per-event criteria/comments/watch-fors come from the guides (events.ts);
// this only adds the cross-event framing the guides don't carry.

export type Category = 'public_speaking' | 'interp' | 'limited_prep' | 'spoken_word';

export const CATEGORY_LABEL: Record<Category, string> = {
  public_speaking: 'Public Address',
  interp: 'Interpretation',
  limited_prep: 'Limited Prep',
  spoken_word: 'Spoken Word',
};

// The "ask yourself" prompt shown while judging, per the quick reference.
export const CATEGORY_MINDSET: Record<Category, string> = {
  public_speaking: 'Did I learn something or change my mind? Was the argument earned?',
  interp: 'Did I believe the characters? Did the story affect me?',
  limited_prep: 'Did they actually answer the question? Was the analysis genuine? Be charitable about small stumbles — this is limited prep.',
  spoken_word: 'Is the writing original and fresh? Did the performance embody the poem?',
};

// timeLimitSec/graceSec drive the stopwatch + summary-table over-time flags.
// Derived from the guides/quick reference; grace is 0 where the guides state no
// grace period (the 5-minute "including introduction" events). Indicative — the
// tab is the official timekeeper.
export interface EventMeta { code: string; category: Category; timeLimitSec: number; graceSec: number; }

export const EVENT_META: Record<string, EventMeta> = {
  original_oratory: { code: 'OO', category: 'public_speaking', timeLimitSec: 600, graceSec: 30 },
  informative_speaking: { code: 'INFO', category: 'public_speaking', timeLimitSec: 600, graceSec: 30 },
  expository_speaking: { code: 'EXP', category: 'public_speaking', timeLimitSec: 300, graceSec: 0 },
  declamation: { code: 'DEC', category: 'public_speaking', timeLimitSec: 600, graceSec: 30 },
  dramatic_interpretation: { code: 'DI', category: 'interp', timeLimitSec: 600, graceSec: 30 },
  humorous_interpretation: { code: 'HI', category: 'interp', timeLimitSec: 600, graceSec: 30 },
  duo_interpretation: { code: 'DUO', category: 'interp', timeLimitSec: 600, graceSec: 30 },
  program_oral_interpretation: { code: 'POI', category: 'interp', timeLimitSec: 600, graceSec: 30 },
  poetry: { code: 'POE', category: 'interp', timeLimitSec: 300, graceSec: 0 },
  prose: { code: 'PRO', category: 'interp', timeLimitSec: 300, graceSec: 0 },
  storytelling: { code: 'STO', category: 'interp', timeLimitSec: 300, graceSec: 0 },
  original_spoken_word_poetry: { code: 'OSWP', category: 'spoken_word', timeLimitSec: 300, graceSec: 30 },
  united_states_extemp: { code: 'USX', category: 'limited_prep', timeLimitSec: 420, graceSec: 30 },
  international_extemp: { code: 'IX', category: 'limited_prep', timeLimitSec: 420, graceSec: 30 },
  impromptu: { code: 'IMP', category: 'limited_prep', timeLimitSec: 420, graceSec: 0 },
};

// Display order of category groups in the event picker.
export const CATEGORY_ORDER: Category[] = ['public_speaking', 'interp', 'limited_prep', 'spoken_word'];
