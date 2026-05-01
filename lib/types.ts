export type Bucket =
  | 'DECODE' | 'RESPOND' | 'COMPOSE' | 'EXPLAIN'
  | 'DECIDE' | 'PLAN' | 'VERIFY' | 'CREATE';

export interface PipelineRequest {
  userInput: string;
  requestId: string;
}

export interface ClassifierOptimizerOutput {
  bucket: Bucket;
  optimized_prompt: string;
  preserved_tokens: string[];
}

export interface PipelineResponse {
  finalText: string;
  bucket: Bucket;
  requestId: string;
  latencyMs: number;
}

export interface StageTimings {
  classify_optimize: number;
  answer: number;
  postprocess: number;
  total: number;
}
