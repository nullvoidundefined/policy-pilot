/** Shared interfaces for the PolicyPilot judge eval system. */

export type Collection = 'valve' | 'gitlab';

export interface CitedChunkEval {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  filename: string;
}

export interface GoldenCase {
  id: string;
  collection: Collection;
  question: string;
  referenceAnswer: string;
  generatorModel: string;
}

export interface GoldenFile {
  collectionIds: Record<Collection, string>;
  cases: GoldenCase[];
}

export interface EvalResult extends GoldenCase {
  retrievedChunks: CitedChunkEval[];
  answer: string;
  topK: number;
  promptVariant: string;
}

export interface DimensionScores {
  faithfulness: number;
  answerRelevance: number;
  citationAccuracy: number;
  completeness: number;
  contextRecall: number;
}

export interface ScoredResult extends EvalResult {
  scores: DimensionScores;
  meanScore: number;
  judgeReasoning: string;
}

export interface RunConfig {
  topK: number;
  promptVariant: string;
  variantLabel: string;
  collectionIds: Record<Collection, string>;
}

export interface Recommendations {
  finalMeanScore: number;
  bestTopK: number;
  bestPrompt: string;
  iterationsRun: number;
  dimensionScores: DimensionScores;
  changeLog: Array<{ round: number; change: string; scoreDelta: number }>;
}
