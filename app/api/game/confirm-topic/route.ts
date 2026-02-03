import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * 찬성/반대가 서로 다를 때 역할·팀 배정 후 토론 시작.
 * RLS 때문에 클라이언트가 상대 플레이어 row를 수정할 수 없어 서버(service role)에서 일괄 처리.
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
      .select('id, role')
      .eq('room_id', roomId)
      .eq('is_ai', false);

    if (!humanPlayers || humanPlayers.length < 2) {
      return NextResponse.json({ error: '인간 플레이어 2명 필요' }, { status: 400 });
    }

    const roles = humanPlayers.map(p => p.role).filter(Boolean);
    if (roles.length < 2) {
      return NextResponse.json({ error: '둘 다 역할 선택 필요' }, { status: 400 });
    }
    if (roles[0] === roles[1]) {
      return NextResponse.json({ error: '역할이 같음. retry-topic 또는 assign-random 사용' }, { status: 400 });
    }

    const proPlayer = humanPlayers.find(p => p.role === 'pro');
    const conPlayer = humanPlayers.find(p => p.role === 'con');
    if (!proPlayer || !conPlayer) {
      return NextResponse.json({ error: '찬성/반대 각 1명 필요' }, { status: 400 });
    }

    const { data: aiPlayers } = await supabase
      .from('players')
      .select('id')
      .eq('room_id', roomId)
      .eq('is_ai', true)
      .limit(2);

    const timerEndAt = new Date(Date.now() + 120 * 1000).toISOString();

    // 인간 2명 + AI 2명 role/team 일괄 업데이트 (service role로 RLS 우회)
    await supabase.from('players').update({ role: 'pro', team: 'A' }).eq('id', proPlayer.id);
    await supabase.from('players').update({ role: 'con', team: 'B' }).eq('id', conPlayer.id);
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
    console.error('[confirm-topic]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'confirm-topic 실패' },
      { status: 500 }
    );
  }
}
