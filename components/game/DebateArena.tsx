'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useGame } from '@/contexts/GameContext';
import { useTimer } from '@/hooks/useTimer';
import { createClient } from '@/lib/supabase/client';
import { Timer } from './Timer';
import { TurnIndicator } from './TurnIndicator';
import { CardStack } from './CardStack';
import { InputArea } from './InputArea';
import { TeamSidebar } from './TeamSidebar';
import { 
  getCurrentTurnPlayer, 
  isAiTurn, 
  isSimultaneousPhase, 
  isTeamDefenseTurn,
  getNextPhase,
  calculateTimerEndAt
} from '@/lib/gameLogic';
import { GamePhase, PHASE_TIME_LIMITS } from '@/types/game';

export function DebateArena() {
  const { state, submitCard } = useGame();
  const supabase = useMemo(() => createClient(), []);

  const phase = state.gameState?.phase as GamePhase;
  const players = state.players;
  const cards = state.cards;

  const cardContainerRef = useRef<HTMLDivElement>(null);
  const prevCardCountRef = useRef(0);

  // 카드가 새로 추가된 경우에만 자동 스크롤 (폴링으로 같은 데이터 재설정 시 스크롤 방지)
  useEffect(() => {
    if (cards.length > prevCardCountRef.current && cardContainerRef.current) {
      cardContainerRef.current.scrollTop = cardContainerRef.current.scrollHeight;
    }
    prevCardCountRef.current = cards.length;
  }, [cards]);

  // 현재 플레이어 찾기
  const currentPlayer = state.currentPlayer;

  // 현재 차례 플레이어
  const currentTurnPlayer = getCurrentTurnPlayer(phase, players);

  // 내 차례인지 확인
  const isMyTurn = (() => {
    if (!currentPlayer) return false;
    if (isSimultaneousPhase(phase)) return true;
    if (isTeamDefenseTurn(phase)) {
      const teamRole = phase.includes('conTeam') ? 'con' : 'pro';
      return currentPlayer.role === teamRole;
    }
    return currentTurnPlayer?.id === currentPlayer.id;
  })();

  // 이미 이 페이즈에서 카드를 제출했는지 확인
  const hasSubmittedInPhase = cards.some(
    card => card.phase === phase && card.playerId === currentPlayer?.id
  );

  // 입력 비활성화 조건
  const isInputDisabled = !isMyTurn || hasSubmittedInPhase || isAiTurn(phase);

  // 타임아웃 처리
  const handleTimeout = useCallback(async () => {
    if (!state.room || !state.gameState) return;

    // 다음 페이즈로 진행
    const nextPhase = getNextPhase(phase);
    if (nextPhase) {
      const timerEndAt = calculateTimerEndAt(nextPhase);
      
      await supabase
        .from('game_states')
        .update({
          phase: nextPhase,
          timer_end_at: timerEndAt,
        })
        .eq('room_id', state.room.id);
    }
  }, [state.room, state.gameState, phase, supabase]);

  const { remaining, formattedTime } = useTimer(
    state.gameState?.timerEndAt || null,
    { onTimeout: handleTimeout }
  );

  // 카드 제출 핸들러
  const handleSubmit = async (content: string) => {
    await submitCard(content);
  };

  const totalSeconds = PHASE_TIME_LIMITS[phase] || 60;

  return (
    <div className="flex gap-6">
      {/* Left Sidebar - Pro Team */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <TeamSidebar 
          team="pro" 
          players={players.filter(p => p.role === 'pro')}
          currentTurnPlayerId={currentTurnPlayer?.id}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div>
            <p className="text-sm text-gray-700 mb-1">토론 주제</p>
            <h2 className="text-lg font-bold text-gray-900">
              &ldquo;{state.gameState?.topic}&rdquo;
            </h2>
          </div>
        </div>

        {/* Turn Indicator */}
        <div className="mb-4">
          <TurnIndicator
            phase={phase}
            currentTurnPlayer={currentTurnPlayer}
            players={players}
            isMyTurn={isMyTurn && !hasSubmittedInPhase}
          />
        </div>

        {/* Card Stack */}
        <div ref={cardContainerRef} className="bg-white rounded-xl border border-gray-200 p-4 mb-4 max-h-[400px] overflow-y-auto">
          <CardStack 
            cards={cards} 
            players={players}
            currentPhase={phase}
          />
        </div>

        {/* Timer */}
        <div className="flex justify-center mb-4">
          <Timer
            remaining={remaining}
            formattedTime={formattedTime}
            totalSeconds={totalSeconds}
          />
        </div>

        {/* Input Area */}
        <InputArea
          onSubmit={handleSubmit}
          isDisabled={isInputDisabled}
          placeholder={
            hasSubmittedInPhase 
              ? '이미 이 단계에서 발언을 제출했습니다' 
              : '논리적인 주장을 작성하세요...'
          }
        />

        {/* Mobile Team Info */}
        <div className="lg:hidden mt-4 grid grid-cols-2 gap-4">
          <TeamSidebar 
            team="pro" 
            players={players.filter(p => p.role === 'pro')}
            currentTurnPlayerId={currentTurnPlayer?.id}
            compact
          />
          <TeamSidebar 
            team="con" 
            players={players.filter(p => p.role === 'con')}
            currentTurnPlayerId={currentTurnPlayer?.id}
            compact
          />
        </div>
      </div>

      {/* Right Sidebar - Con Team */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <TeamSidebar 
          team="con" 
          players={players.filter(p => p.role === 'con')}
          currentTurnPlayerId={currentTurnPlayer?.id}
        />
      </div>
    </div>
  );
}
