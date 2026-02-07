import { NextResponse } from 'next/server';
import { generateTopic } from '@/lib/openai';

export async function POST() {
  try {
    const topic = await generateTopic();
    return NextResponse.json({ topic });
  } catch {
    return NextResponse.json({ error: '주제 생성 실패' }, { status: 500 });
  }
}
