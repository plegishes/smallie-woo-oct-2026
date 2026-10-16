export type CategoryKey =
  | 'likeDontNeed'
  | 'dontLikeNeed'
  | 'dontLikeDontNeed'
  | 'likeNeed';

export interface GiftOption {
  name: string;
  price: number;
}

export interface TranscriptWord {
  id: string;
  word: string;
  start: number;
  end: number;
}

export interface Category {
  key: CategoryKey;
  title: string;
  eyebrow: string;
  blurb: string;
  accent: string;
  gradient: string;
  gifts: GiftOption[];
}

export interface MediaMoment {
  id: string;
  title: string;
  kind: 'image' | 'video';
  start: number;
  end: number;
  caption: string;
  treatment: string;
}

export interface TranscriptionPayload {
  text: string;
  duration: number;
  language: string;
  words: TranscriptWord[];
}
