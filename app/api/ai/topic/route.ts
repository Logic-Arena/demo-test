import { NextResponse } from 'next/server';
import { generateTopic } from '@/lib/openai';

export async function POST() {
  try {
    const topic = await generateTopic();
    return NextResponse.json({ topic });
  } catch (error) {
    const message = error instanceof Error ? error.message : '주제 생성 실패';
    const details = error instanceof Error ? error.stack : String(error);
    console.error('[api/ai/topic] 주제 생성 실패:', details);
    return NextResponse.json(
      { error: '주제 생성 실패', details: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: 500 }
    );
  }
}
