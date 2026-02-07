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

    // 이전 토론 내용을 컨텍스트로 구성 (번호 + 페이즈 라벨 포함)
    const phaseLabel = (p: string): string => {
      if (p.includes('claim')) return '주장';
      if (p.includes('rebuttal')) return '반론';
      if (p.includes('defense')) return '변론';
      if (p.includes('counter')) return '재반론';
      if (p.includes('final')) return '최종';
      return '';
    };

    const conversationHistory = cards.map((card, idx) => {
      const player = players.find(p => p.id === card.playerId);
      const role = player?.role === 'pro' ? '찬성' : '반대';
      const label = phaseLabel(card.phase);
      return `[${idx + 1}] [${role} | ${label}] ${player?.nickname}: ${card.content}`;
    }).join('\n\n');

    // 시스템 프롬프트
    const systemPrompt = getDebaterSystemPrompt(
      aiPlayer.role as 'pro' | 'con',
      topic,
      aiPlayer.nickname,
      players
    );

    // 팀원/상대 이름 추출
    const teammates = players
      .filter(p => p.role === aiPlayer.role && p.id !== aiPlayer.id)
      .map(p => p.nickname);
    const opponents = players
      .filter(p => p.role !== aiPlayer.role && p.role !== null)
      .map(p => p.nickname);
    const opponentNames = opponents.join(', ') || '상대';
    const teammateNames = teammates.join(', ') || '팀원';

    // 현재 단계에 맞는 지시 추가
    let phaseInstruction = '';
    if (phase.includes('claim')) {
      phaseInstruction = `주어진 주제에 대해 당신의 입장을 논리적으로 주장하세요. 팀원(${teammateNames})과 다른 각도에서 접근하세요. "저는 ~라고 생각합니다" 형태로 시작하세요.`;
    } else if (phase.includes('rebuttal')) {
      phaseInstruction = `상대 팀(${opponentNames})의 주장에 대해 논리적으로 반박하세요. "${opponents[0] || '상대'}님이 ~라고 하셨는데"처럼 상대 발언을 구체적으로 인용한 뒤 취약점을 공략하세요.`;
    } else if (phase.includes('defense')) {
      phaseInstruction = `팀의 입장을 변호하고 상대 반론에 대응하세요. 팀원(${teammateNames})의 주장을 보완하면서, 상대(${opponentNames})의 반론을 요약한 뒤 왜 그것이 부족한지 설명하세요.`;
    } else if (phase.includes('counter')) {
      phaseInstruction = `상대(${opponentNames})의 변론 내용을 구체적으로 언급하며 재반론하세요. 핵심 1가지에 집중하여 간결하게 반박하세요.`;
    } else if (phase.includes('final')) {
      phaseInstruction = `최종 의견을 정리하세요. 우리 팀의 핵심 논점을 요약하고, 상대 팀(${opponentNames})의 주장이 왜 부족했는지 지적하며 설득력 있게 마무리하세요.`;
    }

    // 진행 상황 요약
    const totalCards = cards.length;
    const roundInfo = `현재까지 총 ${totalCards}개의 발언이 있었습니다.`;

    // OpenAI API 호출
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `${phaseInstruction}\n\n${roundInfo}\n\n지금까지의 토론 내용:\n${conversationHistory || '(아직 토론 내용이 없습니다)'}\n\n다른 참가자의 이름과 발언을 구체적으로 언급하며 답변하세요.\n\n${aiPlayer.nickname}의 발언:`
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
