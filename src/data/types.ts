// Structured event data derived from the markdown judge guides by
// scripts/build-data.ts. DO NOT hand-edit src/data/events.ts — edit the guide
// .md files and re-run `bun run build:data`. The guides are the source of truth.

export type RatingLevel = 'excellent' | 'good' | 'needs_work';
export type CommentTone = 'strong' | 'average' | 'needs_work';

export interface CriterionDef {
  key: string;            // slug, stable id used in saved ballots
  name: string;           // e.g. "Vocal Delivery"
  whatToEvaluate: string;
  levels: Record<RatingLevel, string>; // indicator text per rating level
}

export interface CommentDef {
  id: string;             // `${eventKey}.${criterionKey}.${tone}.${index}` — one per fragment
  criterionKey: string;
  tone: CommentTone;
  text: string;           // a short fragment (placeholder chip), not a full sentence
}

export interface EventDef {
  key: string;            // slug, stable id used in saved ballots
  name: string;           // display name from the guide's H1
  meta: string;           // the guide's blockquote line (level / time / props)
  guideFile: string;      // source markdown filename, for reference
  criteria: CriterionDef[];
  comments: CommentDef[];
  watchFor: string[];     // "Things to Watch For as a Judge" bullets
}
