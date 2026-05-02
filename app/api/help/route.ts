import { NextResponse } from 'next/server';
import { runPipeline } from '@/lib/pipeline';

export const maxDuration = 30;
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { input } = await req.json();

    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      return NextResponse.json({ error: 'empty_input' }, { status: 400 });
    }
    if (input.length > 4000) {
      return NextResponse.json({ error: 'input_too_long' }, { status: 400 });
    }

    const result = await runPipeline(input.trim());
    return NextResponse.json({ text: result.finalText, bucket: result.bucket });
  } catch (err) {
    console.error('Pipeline error:', err);
    return NextResponse.json({ error: 'pipeline_failure' }, { status: 500 });
  }
}
