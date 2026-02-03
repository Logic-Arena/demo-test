import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * 3번째 같은 역할일 때 서버에서 랜덤으로 찬성/반대 배정 후 토론 시작.
 */
export async function POST(request: NextRequest) {
  try {
    const { roomId } = await request.json();
    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json({ error: 'roomId 필요' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: humanPlayers } = await supabase
      .from('players')
      .select('id')
      .eq('room_id', roomId)
      .eq('is_ai', false);

    const { data: aiPlayers } = await supabase
      .from('players')
      .select('id')
      .eq('room_id', roomId)
      .eq('is_ai', true)
      .limit(2);

    if (!humanPlayers || humanPlayers.length < 2) {
      return NextResponse.json({ error: '인간 플레이어 2명 필요' }, { status: 400 });
    }

    const shuffled = [...humanPlayers].sort(() => Math.random() - 0.5);
    const proId = shuffled[0].id;
    const conId = shuffled[1].id;

    const timerEndAt = new Date(Date.now() + 120 * 1000).toISOString();

    await supabase.from('players').update({ role: 'pro', team: 'A' }).eq('id', proId);
    await supabase.from('players').update({ role: 'con', team: 'B' }).eq('id', conId);
    if (aiPlayers && aiPlayers.length >= 2) {
      await supabase.from('players').update({ role: 'pro', team: 'A' }).eq('id', aiPlayers[0].id);
      await supabase.from('players').update({ role: 'con', team: 'B' }).eq('id', aiPlayers[1].id);
    }

    await supabase
      .from('game_states')
      .update({ phase: 'phase0_claim', timer_end_at: timerEndAt })
      .eq('room_id', roomId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[assign-random]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'assign-random 실패' },
      { status: 500 }
    );
  }
}
