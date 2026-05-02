import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 30;
export const runtime = 'nodejs';

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return _anthropic;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type AllowedType = typeof ALLOWED_TYPES[number];

export async function POST(req: Request) {
  try {
    const { image, mimeType } = await req.json();

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'missing_image' }, { status: 400 });
    }

    const mediaType: AllowedType = ALLOWED_TYPES.includes(mimeType as AllowedType)
      ? (mimeType as AllowedType)
      : 'image/jpeg';

    const response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: image },
          },
          {
            type: 'text',
            text: 'Extract all text from this document or letter exactly as written. Include every number, date, dollar amount, reference number, and name. Return only the extracted text — no commentary, no formatting changes.',
          },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    if (!text) {
      return NextResponse.json({ error: 'no_text_found' }, { status: 422 });
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error('Scan error:', err);
    return NextResponse.json({ error: 'scan_failed' }, { status: 500 });
  }
}
