'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGame } from '@/contexts/GameContext';
import { createClient } from '@/lib/supabase/client';
import { useTimer } from '@/hooks/useTimer';
import { Timer } from '@/components/game/Timer';
import { ThumbsUp, ThumbsDown, AlertCircle, Shuffle } from 'lucide-react';
import { getRandomTopic } from '@/lib/gameLogic';
import { Player } from '@/types/game';

function mapPlayerFromDb(row: Record<string, unknown>): Player {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    userId: row.user_id as string | null,
    nickname: row.nickname as string,
    role: row.role as 'pro' | 'con' | null,
    isAi: row.is_ai as boolean,
    team: row.team as 'A' | 'B' | null,
    joinedAt: row.joined_at as string,
  };
}

export function TopicSelection() {
  const { state, selectRole } = useGame();
  const [selectedRole, setSelectedRole] = useState<'pro' | 'con' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const currentPlayer = state.currentPlayer;
  const proceedingRef = useRef(false);

  // topic 변경 시 selectedRole 리셋 (리더가 retryWithNewTopic 실행 후 비리더에서도 리셋)
  const prevTopicRef = useRef(state.gameState?.topic);
  useEffect(() => {
    if (state.gameState?.topic && state.gameState.topic !== prevTopicRef.current) {
      prevTopicRef.current = state.gameState.topic;
      setSelectedRole(null);
      setIsSubmitting(false);
      proceedingRef.current = false;
    }
  }, [state.gameState?.topic]);

  const handleTimeout = async () => {
    // 시간 초과 시 처리
    await checkSelectionsAndProceed();
  };

  const { remaining, formattedTime } = useTimer(
    state.gameState?.timerEndAt || null,
    { onTimeout: handleTimeout }
  );

  // 인간 플레이어 전원이 역할을 선택했는지 확인 (gameState 로드 후에도 재실행되도록 의존성 포함)
  useEffect(() => {
    if (!state.gameState || state.gameState.phase !== 'topic_selection') return;
    const humanPlayers = state.players.filter(p => !p.isAi);
    const allSelected = humanPlayers.length >= 2 && humanPlayers.every(p => p.role);
    if (allSelected) checkSelectionsAndProceed();
  }, [state.players, state.gameState?.phase, state.gameState?.topic]);

  // 마운트 시 이미 찬성/반대가 둘 다 선택된 상태면 진행 (초기 로드·늦은 동기화 대비)
  useEffect(() => {
    if (!state.room || state.gameState?.phase !== 'topic_selection') return;
    const t = setTimeout(() => checkSelectionsAndProceed(), 600);
    return () => clearTimeout(t);
  }, [state.room?.id, state.gameState?.phase]);

  const checkSelectionsAndProceed = async () => {
    if (!state.room || !state.gameState) return;
    if (proceedingRef.current) return;

    // DB에서 최신 플레이어 조회
    const { data: freshPlayers } = await supabase
      .from('players').select('*')
      .eq('room_id', state.room.id).eq('is_ai', false);

    if (!freshPlayers || freshPlayers.length < 2) return;
    const roles = freshPlayers.map(p => p.role).filter(Boolean);
    if (roles.length < 2) return; // 한쪽 미선택

    proceedingRef.current = true;
    const topicAttempts = state.gameState?.topicAttempts ?? 0;

    if (roles[0] !== roles[1]) {
      // 다른 역할 → 배정 후 시작
      const proId = freshPlayers.find(p => p.role === 'pro')!.id;
      const conId = freshPlayers.find(p => p.role === 'con')!.id;
      await assignRolesAndStartDebate(proId, conId);
    } else {
      // 같은 역할 → 재시도 or 랜덤
      proceedingRef.current = false;
      if (topicAttempts >= 2) {
        await assignRolesRandomly();
      } else {
        await retryWithNewTopic(topicAttempts);
      }
    }
  };

  const retryWithNewTopic = async (currentAttempts: number) => {
    if (!state.room) return;

    const newTopic = getRandomTopic();
    const timerEndAt = new Date(Date.now() + 30 * 1000).toISOString();

    // game_states 업데이트 (topic, timer 등)
    await supabase
      .from('game_states')
      .update({
        topic: newTopic,
        topic_attempts: currentAttempts + 1,
        timer_end_at: timerEndAt,
      })
      .eq('room_id', state.room.id);

    // 인간 플레이어 role 초기화
    const humanPlayers = state.players.filter(p => !p.isAi);
    await Promise.all(
      humanPlayers.map(p => supabase.from('players').update({ role: null }).eq('id', p.id))
    );

    setSelectedRole(null);
  };

  const assignRolesRandomly = async () => {
    if (!state.room) return;

    const humanPlayers = state.players.filter(p => !p.isAi);
    let aiPlayers = state.players.filter(p => p.isAi);
    if (aiPlayers.length < 2) {
      const { data } = await supabase.from('players').select('*')
        .eq('room_id', state.room.id).eq('is_ai', true);
      if (data) aiPlayers = data.map(mapPlayerFromDb);
    }

    const shuffled = [...humanPlayers].sort(() => Math.random() - 0.5);
    await Promise.all([
      supabase.from('players').update({ role: 'pro', team: 'A' }).eq('id', shuffled[0].id),
      supabase.from('players').update({ role: 'con', team: 'B' }).eq('id', shuffled[1].id),
      ...(aiPlayers.length >= 2 ? [
        supabase.from('players').update({ role: 'pro', team: 'A' }).eq('id', aiPlayers[0].id),
        supabase.from('players').update({ role: 'con', team: 'B' }).eq('id', aiPlayers[1].id),
      ] : []),
    ]);
    await startDebate();
  };

  const assignRolesAndStartDebate = async (proPlayerId: string, conPlayerId: string) => {
    if (!state.room) return;

    let aiPlayers = state.players.filter(p => p.isAi);
    if (aiPlayers.length < 2) {
      const { data } = await supabase.from('players').select('*')
        .eq('room_id', state.room.id).eq('is_ai', true);
      if (data) aiPlayers = data.map(mapPlayerFromDb);
    }

    // 인간 플레이어 역할·팀 배정
    await Promise.all([
      supabase.from('players').update({ role: 'pro', team: 'A' }).eq('id', proPlayerId),
      supabase.from('players').update({ role: 'con', team: 'B' }).eq('id', conPlayerId),
      ...(aiPlayers.length >= 2 ? [
        supabase.from('players').update({ role: 'pro', team: 'A' }).eq('id', aiPlayers[0].id),
        supabase.from('players').update({ role: 'con', team: 'B' }).eq('id', aiPlayers[1].id),
      ] : []),
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
      // 선택 후 짧은 간격으로 재시도하여 상대방 선택 감지 즉시 진행
      for (let i = 0; i < 6; i++) {
        if (proceedingRef.current) break;
        await checkSelectionsAndProceed();
        if (proceedingRef.current) break;
        await new Promise(r => setTimeout(r, 1000));
      }
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
          <Timer remaining={remaining} formattedTime={formattedTime} totalSeconds={30} />
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
