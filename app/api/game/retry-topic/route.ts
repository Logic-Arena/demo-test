import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getRandomTopic } from '@/lib/gameLogic';

/**
 * 같은 역할(찬성/찬성 또는 반대/반대)일 때 주제만 바꾸고 인간 역할 초기화.
 * 서버에서 role 초기화해 RLS 이슈 없이 처리.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, topicAttempts = 0 } = body;
    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json({ error: 'roomId 필요' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const newTopic = getRandomTopic();
    const timerEndAt = new Date(Date.now() + 30 * 1000).toISOString();

    await supabase
      .from('game_states')
      .update({
        topic: newTopic,
        topic_attempts: topicAttempts + 1,
        timer_end_at: timerEndAt,
      })
      .eq('room_id', roomId);

    const { data: humanPlayers } = await supabase
      .from('players')
      .select('id')
      .eq('room_id', roomId)
      .eq('is_ai', false);

    if (humanPlayers?.length) {
      for (const p of humanPlayers) {
        await supabase.from('players').update({ role: null, team: null }).eq('id', p.id);
      }
    }

    return NextResponse.json({ ok: true, topic: newTopic });
  } catch (err) {
    console.error('[retry-topic]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'retry-topic 실패' },
      { status: 500 }
    );
  }
}
