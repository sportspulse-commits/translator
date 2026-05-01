import Anthropic from '@anthropic-ai/sdk';
import { getRedis } from './redis';
import { runPostprocess } from './postprocess';
import type { Bucket, PipelineResponse } from './types';
import { CLASSIFIER_OPTIMIZER_PROMPT } from '@/prompts';
import { randomUUID } from 'crypto';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const VERIFY_MODEL = 'claude-sonnet-4-5';
const ANSWER_MODEL = 'claude-sonnet-4-5';
const FAST_MODEL = 'claude-haiku-4-5-20251001';

const BUCKET_LENGTH_CAPS: Record<Bucket, number> = {
  DECODE: 150, RESPOND: 180, COMPOSE: 250, EXPLAIN: 200,
  DECIDE: 400, PLAN: 500, VERIFY: 450, CREATE: 400,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(msg: any): string {
  return msg.content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((b: any) => b.type === 'text')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b: any) => b.text).join('');
}

function parseClassifierOutput(raw: string): {
  bucket: Bucket; optimized_prompt: string; preserved_tokens: string[];
} {
  const bucketMatch = raw.match(/<bucket>(\w+)<\/bucket>/);
  const promptMatch = raw.match(/<optimized_prompt>([\s\S]*?)<\/optimized_prompt>/);
  const tokensMatch = raw.match(/<preserved_tokens>([\s\S]*?)<\/preserved_tokens>/);
  if (!bucketMatch || !promptMatch) {
    throw new Error('Classifier output malformed');
  }
  const validBuckets: Bucket[] = ['DECODE','RESPOND','COMPOSE','EXPLAIN','DECIDE','PLAN','VERIFY','CREATE'];
  const candidate = bucketMatch[1] as Bucket;
  if (!validBuckets.includes(candidate)) {
    throw new Error(`Invalid bucket: ${candidate}`);
  }
  return {
    bucket: candidate,
    optimized_prompt: promptMatch[1].trim(),
    preserved_tokens: tokensMatch
      ? tokensMatch[1].split('|').map((s: string) => s.trim()).filter(Boolean)
      : [],
  };
}

export async function runPipeline(input: string): Promise<PipelineResponse> {
  const requestId = randomUUID();
  const t0 = Date.now();
  const timings: Record<string, number> = {};

  const t1 = Date.now();
  const classifyResult = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 1500,
    temperature: 0,
    system: CLASSIFIER_OPTIMIZER_PROMPT,
    messages: [{ role: 'user', content: `<user_input>${input}</user_input>` }],
  });
  timings.classify_optimize = Date.now() - t1;

  const parsed = parseClassifierOutput(extractText(classifyResult));

  const t2 = Date.now();
  const answerModel = parsed.bucket === 'VERIFY' ? VERIFY_MODEL : ANSWER_MODEL;
  const answerTemp = parsed.bucket === 'CREATE' ? 0.4 : 0;

  const answerResult = await anthropic.messages.create({
    model: answerModel,
    max_tokens: 2000,
    temperature: answerTemp,
    messages: [{ role: 'user', content: parsed.optimized_prompt }],
  });
  timings.answer = Date.now() - t2;
  const draft = extractText(answerResult);

  const t3 = Date.now();
  const final = await runPostprocess({
    draft,
    bucket: parsed.bucket,
    lengthCap: BUCKET_LENGTH_CAPS[parsed.bucket],
    preservedTokens: parsed.preserved_tokens,
  });
  timings.postprocess = Date.now() - t3;
  timings.total = Date.now() - t0;

  try {
    await getRedis().setex(
      `req:${requestId}`,
      60 * 60 * 24 * 7,
      JSON.stringify({
        input, bucket: parsed.bucket,
        optimized: parsed.optimized_prompt,
        draft, final, timings,
      })
    );
  } catch (e) {
    console.error('Redis log failed:', e);
  }

  console.log(JSON.stringify({
    type: 'pipeline_complete',
    requestId,
    bucket: parsed.bucket,
    timings,
    inputLength: input.length,
    outputLength: final.length,
  }));

  return { finalText: final, bucket: parsed.bucket, requestId, latencyMs: timings.total };
}
