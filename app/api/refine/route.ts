import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';
import { getUserPlan, canUseFeature } from '@/lib/plan';

export const maxDuration = 30;
export const runtime = 'nodejs';

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return _anthropic;
}

const PROMPTS = {
  shorter:
    'Rewrite the following plain-language response to be shorter and more direct. Keep only the most essential information and the single clearest action step. Remove any repetition or background context. Preserve bold text for key facts. Return only the rewritten response.',
  longer:
    'Expand the following plain-language response with more detail and clearer step-by-step guidance. Use simple words an older adult would understand. Add context where helpful. Preserve bold text and any list formatting. Return only the expanded response.',
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const planData = await getUserPlan(userId);
    if (!canUseFeature(planData.plan, 'refine')) {
      return NextResponse.json({ error: 'plan_required' }, { status: 403 });
    }

    const { answer, direction } = await req.json();

    if (!answer || (direction !== 'shorter' && direction !== 'longer')) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 });
    }

    const response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `${PROMPTS[direction as 'shorter' | 'longer']}\n\n${answer}`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    return NextResponse.json({ text });
  } catch (err) {
    console.error('Refine error:', err);
    return NextResponse.json({ error: 'refine_failed' }, { status: 500 });
  }
}
