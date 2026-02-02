'use client';

import { useState, useEffect, useMemo } from 'react';
import { useGame } from '@/contexts/GameContext';
import { createClient } from '@/lib/supabase/client';
import { useTimer } from '@/hooks/useTimer';
import { Timer } from '@/components/game/Timer';
import { ThumbsUp, ThumbsDown, AlertCircle, Shuffle } from 'lucide-react';
import { getRandomTopic } from '@/lib/gameLogic';

export function TopicSelection() {
  const { state, selectRole } = useGame();
  const [selectedRole, setSelectedRole] = useState<'pro' | 'con' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const currentPlayer = state.players.find(
    p => !p.isAi && localStorage.getItem(`room_${state.room?.id}_joined`)
  );

  const handleTimeout = async () => {
    // 시간 초과 시 처리
    await checkSelectionsAndProceed();
  };

  const { remaining, formattedTime } = useTimer(
    state.gameState?.timerEndAt || null,
    { onTimeout: handleTimeout }
  );

  useEffect(() => {
    // 선택이 완료되었는지 확인
    if (state.gameState?.proSelection && state.gameState?.conSelection) {
      checkSelectionsAndProceed();
    }
  }, [state.gameState?.proSelection, state.gameState?.conSelection]);

  const checkSelectionsAndProceed = async () => {
    if (!state.room || !state.gameState) return;

    // 서버에서 최신 상태를 가져와서 판단 (Realtime 지연·타이밍 이슈 방지)
    const { data: fresh } = await supabase
      .from('game_states')
      .select('pro_selection, con_selection, topic_attempts')
      .eq('room_id', state.room.id)
      .single();

    const proSelection = fresh?.pro_selection ?? state.gameState.proSelection;
    const conSelection = fresh?.con_selection ?? state.gameState.conSelection;
    const topicAttempts = fresh?.topic_attempts ?? state.gameState.topicAttempts;

    // 찬성/반대가 서로 다르게 선택됐으면 → 그 주제로 게임 진행
    const hasDifferentSelections = proSelection && conSelection && proSelection !== conSelection;
    if (hasDifferentSelections) {
      await assignRolesAndStartDebate(proSelection, conSelection);
      return;
    }

    // 한 명만 선택했거나 아무도 안 했으면 아무것도 하지 않음 (상대 선택·타이머 대기)
    if (!proSelection || !conSelection) {
      return;
    }

    // 둘 다 선택했는데 같은 역할(찬성+찬성 또는 반대+반대)인 경우에만 새 주제/랜덤
    if (topicAttempts >= 2) {
      await assignRolesRandomly();
    } else {
      await retryWithNewTopic(topicAttempts);
    }
  };

  const retryWithNewTopic = async (currentAttempts: number) => {
    if (!state.room) return;

    const newTopic = getRandomTopic();
    const timerEndAt = new Date(Date.now() + 10 * 1000).toISOString();

    await supabase
      .from('game_states')
      .update({
        topic: newTopic,
        topic_attempts: currentAttempts + 1,
        timer_end_at: timerEndAt,
        pro_selection: null,
        con_selection: null,
      })
      .eq('room_id', state.room.id);

    setSelectedRole(null);
  };

  const assignRolesRandomly = async () => {
    if (!state.room) return;

    const humanPlayers = state.players.filter(p => !p.isAi);
    const aiPlayers = state.players.filter(p => p.isAi);

    // 랜덤으로 역할 배정
    const shuffled = [...humanPlayers].sort(() => Math.random() - 0.5);
    const proHuman = shuffled[0];
    const conHuman = shuffled[1];
    const proAi = aiPlayers[0];
    const conAi = aiPlayers[1];

    // 플레이어 역할 업데이트
    await Promise.all([
      supabase.from('players').update({ role: 'pro', team: 'A' }).eq('id', proHuman.id),
      supabase.from('players').update({ role: 'con', team: 'B' }).eq('id', conHuman.id),
      supabase.from('players').update({ role: 'pro', team: 'A' }).eq('id', proAi.id),
      supabase.from('players').update({ role: 'con', team: 'B' }).eq('id', conAi.id),
    ]);

    // 게임 시작
    await startDebate();
  };

  const assignRolesAndStartDebate = async (proPlayerId: string, conPlayerId: string) => {
    if (!state.room) return;

    const aiPlayers = state.players.filter(p => p.isAi);

    // 찬성/반대 선택한 플레이어에 맞춰 역할·팀 배정
    await Promise.all([
      supabase.from('players').update({ role: 'pro', team: 'A' }).eq('id', proPlayerId),
      supabase.from('players').update({ role: 'con', team: 'B' }).eq('id', conPlayerId),
      supabase.from('players').update({ role: 'pro', team: 'A' }).eq('id', aiPlayers[0].id),
      supabase.from('players').update({ role: 'con', team: 'B' }).eq('id', aiPlayers[1].id),
    ]);

    await startDebate();
  };

  const startDebate = async () => {
    if (!state.room) return;

    const timerEndAt = new Date(Date.now() + 120 * 1000).toISOString(); // 2분

    await supabase
      .from('game_states')
      .update({
        phase: 'phase0_claim',
        timer_end_at: timerEndAt,
      })
      .eq('room_id', state.room.id);
  };

  const handleSelect = async (role: 'pro' | 'con') => {
    if (isSubmitting || selectedRole) return;

    setIsSubmitting(true);
    setSelectedRole(role);

    try {
      await selectRole(role);
      // 선택 후 바로 서버에서 최신 상태를 조회해서 둘 다 선택됐으면 진행
      // (Realtime이 안 될 때도 동작하도록)
      await checkSelectionsAndProceed();
    } catch (error) {
      console.error('역할 선택 실패:', error);
      setSelectedRole(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const topicAttempts = state.gameState?.topicAttempts || 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        {/* Timer */}
        <div className="flex justify-center mb-6">
          <Timer remaining={remaining} formattedTime={formattedTime} totalSeconds={10} />
        </div>

        {/* Topic */}
        <div className="text-center mb-8">
          <p className="text-sm text-gray-700 mb-2">
            토론 주제 {topicAttempts > 0 && `(${topicAttempts + 1}번째 시도)`}
          </p>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            &ldquo;{state.gameState?.topic}&rdquo;
          </h2>
          <p className="text-gray-800">
            찬성 또는 반대를 선택하세요. 선택이 겹치면 새 주제가 제안됩니다.
          </p>
        </div>

        {/* Warning for multiple attempts */}
        {topicAttempts >= 2 && (
          <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">마지막 기회!</p>
              <p className="text-sm text-yellow-700">
                이번에도 선택이 겹치면 AI가 랜덤으로 역할을 배정합니다.
              </p>
            </div>
          </div>
        )}

        {/* Role Selection */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => handleSelect('pro')}
            disabled={isSubmitting || !!selectedRole}
            className={`p-6 rounded-xl border-2 transition-all ${
              selectedRole === 'pro'
                ? 'border-blue-500 bg-blue-50'
                : selectedRole
                ? 'border-gray-200 bg-gray-50 opacity-50'
                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={`p-3 rounded-full ${
                selectedRole === 'pro' ? 'bg-blue-500' : 'bg-blue-100'
              }`}>
                <ThumbsUp className={`w-6 h-6 ${
                  selectedRole === 'pro' ? 'text-white' : 'text-blue-600'
                }`} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">찬성</p>
                <p className="text-sm text-gray-700">Pro</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleSelect('con')}
            disabled={isSubmitting || !!selectedRole}
            className={`p-6 rounded-xl border-2 transition-all ${
              selectedRole === 'con'
                ? 'border-red-500 bg-red-50'
                : selectedRole
                ? 'border-gray-200 bg-gray-50 opacity-50'
                : 'border-gray-200 hover:border-red-300 hover:bg-red-50'
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={`p-3 rounded-full ${
                selectedRole === 'con' ? 'bg-red-500' : 'bg-red-100'
              }`}>
                <ThumbsDown className={`w-6 h-6 ${
                  selectedRole === 'con' ? 'text-white' : 'text-red-600'
                }`} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">반대</p>
                <p className="text-sm text-gray-700">Con</p>
              </div>
            </div>
          </button>
        </div>

        {/* Selection Status */}
        {selectedRole && (
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-800">
              <span className={selectedRole === 'pro' ? 'text-blue-600' : 'text-red-600'}>
                {selectedRole === 'pro' ? '찬성' : '반대'}
              </span>
              을 선택했습니다. 상대방의 선택을 기다리는 중...
            </p>
          </div>
        )}

        {/* Team Info */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-800">
            <Shuffle className="w-4 h-4" />
            <span>선택 후 AI 파트너가 같은 팀으로 배정됩니다</span>
          </div>
        </div>
      </div>
    </div>
  );
}
