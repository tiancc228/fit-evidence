export type Goal = "muscle" | "fatloss" | "recomp";
export type Sex = "male" | "female";
export type Activity = "sedentary" | "light" | "moderate" | "high" | "athlete";
export type Verdict = "supported" | "partial" | "conflict" | "insufficient";
export type ReviewState = "ai_extracted" | "pending_review" | "human_confirmed" | "published";

export interface Profile {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number | null;
  activity: Activity;
  goal: Goal;
  trainingDaysPerWeek: number;
  createdAt: string;
}

export interface BodyEntry {
  id: string;
  date: string;
  weightKg: number;
  bodyFatPct: number | null;
  waistCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  photoId: string | null;
  note: string;
}

export interface FoodItem {
  id: string;
  name: string;
  category: string;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
  unit: string;
  gramsPerUnit: number | null;
}

export interface MealEntry {
  id: string;
  date: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  foodId: string | null;
  label: string;
  grams: number;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  photoId: string | null;
  source: "manual" | "ai" | "database";
  note: string;
}

export interface SetEntry {
  reps: number;
  weightKg: number;
  rpe: number | null;
}

export interface TrainingEntry {
  id: string;
  date: string;
  exerciseId: string;
  name: string;
  part: string;
  sets: SetEntry[];
  durationMin: number;
  feel: 1 | 2 | 3 | 4 | 5;
  pump: 1 | 2 | 3 | 4 | 5;
  soreness: 1 | 2 | 3 | 4 | 5;
  photoId: string | null;
  note: string;
}

export interface SleepEntry {
  id: string;
  date: string;
  hours: number;
  quality: 1 | 2 | 3 | 4 | 5;
}

export interface EvidenceRef {
  doi: string | null;
  pmid: string | null;
  title: string;
  authors: string[];
  journal: string | null;
  year: number | null;
  abstract: string | null;
  url: string | null;
  provider: string;
  pubType?: string[];
  citedBy?: number | null;
  topic?: string;
  supports?: string;
}

export interface BloggerSource {
  platform: "bilibili" | "douyin";
  bvid?: string;
  aweme_id?: string;
  title: string;
  author: string;
  mid?: number;
  pubdate?: number;
  duration?: number | string;
  description?: string;
  url: string;
  pic?: string | null;
}

/** The four layers are separate fields on purpose: they must never be merged. */
export interface Claim {
  id: string;
  topic: string;
  topicLabel: string;
  layer1: {
    quote: string | null;
    startSec: number | null;
    endSec: number | null;
    source: BloggerSource | null;
    missingReason: string | null;
  };
  layer2: {
    statement: string;
    claimType: "efficacy" | "dosage" | "mechanism" | "safety" | "technique" | "diet";
    generatedBy: "ai" | "human";
    rationale: string | null;
  };
  layer3: {
    verdict: Verdict;
    evidence: { ref: EvidenceRef; relation: "supports" | "refutes" | "partial" | "context"; strength: "high" | "medium" | "low"; note: string }[];
    guideline: { title: string; issuer: string; publishedAt: string; clause: string; url: string | null }[];
    verdictReason: string;
  };
  layer4: {
    advice: string | null;
    appliesTo: string[];
    notFor: string[];
    reviewedBy: string | null;
  };
  review: {
    state: ReviewState;
    history: { at: string; actor: string; action: string; from: string | null; to: string | null; note: string }[];
  };
  exerciseIds: string[];
}

export interface Exercise {
  id: string;
  name: string;
  nameEn: string;
  part: string;
  pattern: string;
  equipment: string;
  level: "novice" | "intermediate" | "advanced";
  cues: string[];
  commonErrors: { error: string; risk: string; fix: string }[];
  videoBvid: string | null;
  met: number;
}

export interface PhotoRecord {
  id: string;
  date: string;
  kind: "body" | "form" | "food";
  dataUrl: string;
  label: string;
  analysis: string | null;
  analysisSource: "ai" | "human" | null;
}

export interface AppState {
  profile: Profile | null;
  body: BodyEntry[];
  meals: MealEntry[];
  training: TrainingEntry[];
  sleep: SleepEntry[];
  photos: PhotoRecord[];
  claimOverrides: Record<string, Partial<Pick<Claim, "review">> & { verdict?: Verdict; advice?: string }>;
  aiKeyConfigured: boolean;
  savedViews: { id: string; name: string; topic: string; verdict: string; author: string }[];
}