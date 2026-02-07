import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateTopic } from '@/lib/openai';

/**
 * 단일 API로 역할 선택 처리
 *
 * 처리 흐름:
 * 1. 내 역할 DB 저장
 * 2. 두 플레이어 역할 조회
 * 3. 한 명만 선택 → {status: 'waiting'}
 * 4. 둘 다 선택 + 역할 다름 → 팀 배정 + phase 전환 → {status: 'started'}
 * 5. 둘 다 선택 + 역할 같음:
 *    - 시도 < 3회 → 새 주제 + 역할 초기화 → {status: 'retry', topic}
 *    - 시도 >= 3회 → 랜덤 배정 + phase 전환 → {status: 'started', random: true}
 */
export async function POST(request: NextRequest) {
  try {
    const { roomId, playerId, role } = await request.json();

    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json({ error: 'roomId 필요' }, { status: 400 });
    }
    if (!playerId || typeof playerId !== 'string') {
      return NextResponse.json({ error: 'playerId 필요' }, { status: 400 });
    }
    if (role !== 'pro' && role !== 'con') {
      return NextResponse.json({ error: 'role은 pro 또는 con이어야 함' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. 내 역할 DB 저장
    const { error: updateError } = await supabase
      .from('players')
      .update({ role })
      .eq('id', playerId);

    if (updateError) {
      console.error('[select-role] 역할 저장 실패:', updateError);
      return NextResponse.json({ error: '역할 저장 실패' }, { status: 500 });
    }

    // 2. 두 인간 플레이어 역할 조회
    const { data: humanPlayers, error: fetchError } = await supabase
      .from('players')
      .select('id, role')
      .eq('room_id', roomId)
      .eq('is_ai', false);

    if (fetchError || !humanPlayers) {
      console.error('[select-role] 플레이어 조회 실패:', fetchError);
      return NextResponse.json({ error: '플레이어 조회 실패' }, { status: 500 });
    }

    if (humanPlayers.length < 2) {
      return NextResponse.json({ error: '인간 플레이어 2명 필요' }, { status: 400 });
    }

    // 3. 한 명만 선택했는지 확인
    const selectedPlayers = humanPlayers.filter(p => p.role);
    if (selectedPlayers.length < 2) {
      return NextResponse.json({ status: 'waiting' });
    }

    // 둘 다 선택함 - 역할 비교
    const roles = selectedPlayers.map(p => p.role);
    const rolesMatch = roles[0] === roles[1];

    // game_state에서 topicAttempts 조회
    const { data: gameState } = await supabase
      .from('game_states')
      .select('topic_attempts')
      .eq('room_id', roomId)
      .single();

    const topicAttempts = gameState?.topic_attempts ?? 0;

    if (!rolesMatch) {
      // 4. 역할 다름 → 팀 배정 + phase 전환
      const proPlayer = humanPlayers.find(p => p.role === 'pro');
      const conPlayer = humanPlayers.find(p => p.role === 'con');

      if (!proPlayer || !conPlayer) {
        return NextResponse.json({ error: '찬성/반대 각 1명 필요' }, { status: 500 });
      }

      // AI 플레이어 조회
      const { data: aiPlayers } = await supabase
        .from('players')
        .select('id')
        .eq('room_id', roomId)
        .eq('is_ai', true)
        .limit(2);

      const timerEndAt = new Date(Date.now() + 120 * 1000).toISOString();

      // 인간 + AI 역할/팀 배정
      await supabase.from('players').update({ role: 'pro', team: 'A' }).eq('id', proPlayer.id);
      await supabase.from('players').update({ role: 'con', team: 'B' }).eq('id', conPlayer.id);

      if (aiPlayers && aiPlayers.length >= 2) {
        await supabase.from('players').update({ role: 'pro', team: 'A' }).eq('id', aiPlayers[0].id);
        await supabase.from('players').update({ role: 'con', team: 'B' }).eq('id', aiPlayers[1].id);
      }

      // phase 전환
      await supabase
        .from('game_states')
        .update({ phase: 'phase0_claim', timer_end_at: timerEndAt })
        .eq('room_id', roomId);

      return NextResponse.json({ status: 'started' });
    }

    // 5. 역할 같음
    if (topicAttempts >= 2) {
      // 3회차(topicAttempts=2는 이미 2번 재시도했음) → 랜덤 배정
      const shuffled = [...humanPlayers].sort(() => Math.random() - 0.5);
      const proId = shuffled[0].id;
      const conId = shuffled[1].id;

      // AI 플레이어 조회
      const { data: aiPlayers } = await supabase
        .from('players')
        .select('id')
        .eq('room_id', roomId)
        .eq('is_ai', true)
        .limit(2);

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

      return NextResponse.json({ status: 'started', random: true });
    }

    // 시도 < 3회 → 새 주제 + 역할 초기화
    const newTopic = await generateTopic();
    const timerEndAt = new Date(Date.now() + 30 * 1000).toISOString();

    // game_state 업데이트 (새 주제, attempts 증가)
    await supabase
      .from('game_states')
      .update({
        topic: newTopic,
        topic_attempts: topicAttempts + 1,
        timer_end_at: timerEndAt,
      })
      .eq('room_id', roomId);

    // 인간 플레이어 역할 초기화
    for (const p of humanPlayers) {
      await supabase.from('players').update({ role: null, team: null }).eq('id', p.id);
    }

    return NextResponse.json({ status: 'retry', topic: newTopic });
  } catch (err) {
    console.error('[select-role]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'select-role 실패' },
      { status: 500 }
    );
  }
}
