import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI, JUDGE_SYSTEM_PROMPT } from '@/lib/openai';
import { createServiceClient } from '@/lib/supabase/server';
import { DebateCard, Player } from '@/types/game';

interface JudgeRequest {
  roomId: string;
  topic: string;
  cards: DebateCard[];
  players: Player[];
}

interface JudgmentResult {
  winnerTeam: 'pro' | 'con' | 'draw';
  scores: Record<string, number>;
  feedback: Record<string, string>;
  overallAnalysis: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: JudgeRequest = await request.json();
    const { roomId, topic, cards, players } = body;

    // 전체 토론 내용을 구성
    const debateLog = cards.map(card => {
      const player = players.find(p => p.id === card.playerId);
      const role = player?.role === 'pro' ? '찬성' : '반대';
      const isAi = player?.isAi ? ' (AI)' : '';
      return `[${role}${isAi}] ${player?.nickname} (ID: ${player?.id}):\n${card.content}`;
    }).join('\n\n---\n\n');

    // 참가자 목록
    const participantList = players.map(p => {
      const role = p.role === 'pro' ? '찬성' : '반대';
      const isAi = p.isAi ? ' (AI)' : '';
      return `- ${p.nickname}${isAi}: ${role} (ID: ${p.id})`;
    }).join('\n');

    // OpenAI API 호출
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: JUDGE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `토론 주제: "${topic}"

참가자:
${participantList}

전체 토론 내용:
${debateLog}

위 토론을 분석하고 판정해주세요. 반드시 지정된 JSON 형식으로 응답하세요.`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error('AI 응답이 없습니다');
    }

    // JSON 파싱
    let judgment: JudgmentResult;
    try {
      judgment = JSON.parse(responseContent);
    } catch {
      throw new Error('판정 결과 파싱 실패');
    }

    // 결과 검증
    if (!judgment.winnerTeam || !judgment.scores || !judgment.feedback || !judgment.overallAnalysis) {
      throw new Error('판정 결과 형식이 올바르지 않습니다');
    }

    // Supabase에 판정 결과 저장
    const supabase = createServiceClient();

    await supabase.from('judgments').insert({
      room_id: roomId,
      winner_team: judgment.winnerTeam,
      scores: judgment.scores,
      feedback: judgment.feedback,
      overall_analysis: judgment.overallAnalysis,
    });

    // 게임 상태를 finished로 변경
    await supabase
      .from('game_states')
      .update({
        phase: 'finished',
        timer_end_at: null,
      })
      .eq('room_id', roomId);

    // 방 상태를 finished로 변경
    await supabase
      .from('rooms')
      .update({ status: 'finished' })
      .eq('id', roomId);

    return NextResponse.json({ success: true, judgment });
  } catch (error) {
    console.error('판정 오류:', error);
    return NextResponse.json(
      { error: '판정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
