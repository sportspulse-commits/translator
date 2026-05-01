import Anthropic from '@anthropic-ai/sdk';
import type { Bucket } from './types';

const AI_TELLS: RegExp[] = [
  /\bI hope this helps\b\.?/gi,
  /\bGreat question\b!?,?/gi,
  /\bSure,? I can help\b\.?/gi,
  /\bLet me know if\b[^.]*\./gi,
  /\bdelve\b/gi,
  /\bnavigate\b/gi,
  /\bin today's[^,.]*world\b/gi,
  /\bit's important to note that\b/gi,
  /\byou've got this\b!?/gi,
  /\bstay positive\b!?/gi,
];

const EM_DASH = /—/g;

export async function runPostprocess(args: {
  draft: string;
  bucket: Bucket;
  lengthCap: number;
  preservedTokens: string[];
}): Promise<string> {
  let text = args.draft.trim();

  for (const pattern of AI_TELLS) {
    text = text.replace(pattern, '');
  }
  text = text.replace(EM_DASH, '. ');

  text = text.replace(/\[([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\]/g, '');

  text = text.replace(/\s+/g, ' ').replace(/\s\./g, '.').trim();

  const missingTokens = args.preservedTokens.filter(
    tok => tok.length > 0 && !text.includes(tok)
  );

  const words = text.split(/\s+/).filter(Boolean);
  const overLength = words.length > args.lengthCap;

  if (missingTokens.length === 0 && !overLength) {
    return text;
  }

  return await llmRepair(text, args, missingTokens, overLength);
}

async function llmRepair(
  text: string,
  args: { bucket: Bucket; lengthCap: number; preservedTokens: string[] },
  missing: string[],
  overLength: boolean,
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const issues = [
    missing.length > 0 && `Missing required verbatim tokens: ${missing.join(', ')}. You must include these exact strings.`,
    overLength && `Text exceeds ${args.lengthCap} words. Cut to fit.`,
  ].filter(Boolean).join(' ');

  const result = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    temperature: 0,
    system: 'You are an editor. Fix only the issues stated. Do not add new content. Do not change facts. Output only the corrected text, no preamble.',
    messages: [{
      role: 'user',
      content: `<text>${text}</text>\n<issues>${issues}</issues>\n<rules>Reading level: 7th-8th grade. No phrases like "I hope this helps" or em-dashes. Preserve all numbers, dates, names exactly.</rules>`,
    }],
  });
  return result.content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((b: any): b is { type: 'text'; text: string } => b.type === 'text')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b: any) => b.text).join('').trim();
}
