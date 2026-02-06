import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI, getDebaterSystemPrompt } from '@/lib/openai';
import { createServiceClient } from '@/lib/supabase/server';
import { DebateCard, Player, GamePhase } from '@/types/game';
import { isSimultaneousPhase, getNextPhase, calculateTimerEndAt } from '@/lib/gameLogic';

interface GenerateRequest {
  roomId: string;
  phase: GamePhase;
  topic: string;
  cards: DebateCard[];
  players: Player[];
  targetPlayerId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { roomId, phase, topic, cards, players, targetPlayerId } = body;

    // AI 플레이어 찾기 — targetPlayerId가 있으면 해당 플레이어, 없으면 기존 로직
    const aiPlayer = targetPlayerId
      ? players.find(p => p.id === targetPlayerId)
      : players.find(p => p.isAi && (phase.includes('aiA') ? p.role === 'pro' : p.role === 'con'));

    if (!aiPlayer) {
      return NextResponse.json({ error: 'AI 플레이어를 찾을 수 없습니다' }, { status: 400 });
    }

    // Supabase 클라이언트 (중복 확인 및 저장에 사용)
    const supabase = createServiceClient();

    // 중복 카드 방지 — 이미 해당 phase+player의 카드가 있으면 스킵
    const { data: existing } = await supabase
      .from('debate_cards')
      .select('id')
      .eq('room_id', roomId)
      .eq('player_id', aiPlayer.id)
      .eq('phase', phase)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, skipped: true });
    }

    // 이전 토론 내용을 컨텍스트로 구성
    const conversationHistory = cards.map(card => {
      const player = players.find(p => p.id === card.playerId);
      const role = player?.role === 'pro' ? '찬성' : '반대';
      const isAi = player?.isAi ? ' (AI)' : '';
      return `[${role}${isAi}] ${player?.nickname}: ${card.content}`;
    }).join('\n\n');

    // 시스템 프롬프트
    const systemPrompt = getDebaterSystemPrompt(aiPlayer.role as 'pro' | 'con', topic);

    // 현재 단계에 맞는 지시 추가
    let phaseInstruction = '';
    if (phase.includes('claim')) {
      phaseInstruction = '주어진 주제에 대해 당신의 입장을 논리적으로 주장하세요.';
    } else if (phase.includes('rebuttal')) {
      phaseInstruction = '상대 팀의 주장에 대해 논리적으로 반박하세요.';
    } else if (phase.includes('counter')) {
      phaseInstruction = '상대의 변론에 대해 간결하게 재반론하세요.';
    } else if (phase.includes('defense')) {
      phaseInstruction = '팀의 입장을 변호하고 상대 반론에 대응하세요.';
    } else if (phase.includes('final')) {
      phaseInstruction = '최종 의견을 정리하여 설득력 있게 마무리하세요.';
    }

    // OpenAI API 호출
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `${phaseInstruction}\n\n지금까지의 토론 내용:\n${conversationHistory || '(아직 토론 내용이 없습니다)'}\n\n당신의 발언:`
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content || '응답을 생성할 수 없습니다.';

    // Supabase에 AI 카드 저장
    await supabase.from('debate_cards').insert({
      room_id: roomId,
      player_id: aiPlayer.id,
      phase: phase,
      content: aiResponse,
    });

    // 동시 제출 페이즈: 전원 제출 완료 시 서버에서 즉시 다음 단계 진행
    if (isSimultaneousPhase(phase)) {
      const { data: phaseCards } = await supabase
        .from('debate_cards')
        .select('player_id')
        .eq('room_id', roomId)
        .eq('phase', phase);

      const { data: roomPlayers } = await supabase
        .from('players')
        .select('id')
        .eq('room_id', roomId);

      if (phaseCards && roomPlayers) {
        const submittedIds = new Set(phaseCards.map(c => c.player_id));
        const allSubmitted = roomPlayers.length > 0
          && roomPlayers.every(p => submittedIds.has(p.id));

        if (allSubmitted) {
          const nextPhase = getNextPhase(phase);
          if (nextPhase) {
            const timerEndAt = calculateTimerEndAt(nextPhase);
            await supabase
              .from('game_states')
              .update({ phase: nextPhase, timer_end_at: timerEndAt })
              .eq('room_id', roomId);
          }
        }
      }
    }

    return NextResponse.json({ success: true, content: aiResponse });
  } catch (error) {
    console.error('AI 생성 오류:', error);
    return NextResponse.json(
      { error: 'AI 응답 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
