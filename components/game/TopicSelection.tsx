'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGame } from '@/contexts/GameContext';
import { createClient } from '@/lib/supabase/client';
import { useTimer } from '@/hooks/useTimer';
import { Timer } from '@/components/game/Timer';
import { ThumbsUp, ThumbsDown, AlertCircle, Shuffle } from 'lucide-react';

export function TopicSelection() {
  const { state, selectRole } = useGame();
  const [selectedRole, setSelectedRole] = useState<'pro' | 'con' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = useMemo(() => createClient(), []);

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

    const { data: freshPlayers } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', state.room.id)
      .eq('is_ai', false);

    if (!freshPlayers || freshPlayers.length < 2) return;
    const roles = freshPlayers.map(p => p.role).filter(Boolean);
    if (roles.length < 2) return;

    proceedingRef.current = true;
    const topicAttempts = state.gameState?.topicAttempts ?? 0;

    try {
      if (roles[0] !== roles[1]) {
        // 찬성/반대 다름 → 서버에서 역할·팀 배정 후 토론 시작 (RLS 우회)
        const res = await fetch('/api/game/confirm-topic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: state.room.id }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('[confirm-topic]', err);
          proceedingRef.current = false;
          return;
        }
      } else {
        // 같은 역할 → 재시도 or 랜덤 (서버에서 처리)
        if (topicAttempts >= 2) {
          const res = await fetch('/api/game/assign-random', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: state.room.id }),
          });
          if (!res.ok) {
            console.error('[assign-random]', await res.json().catch(() => ({})));
            proceedingRef.current = false;
            return;
          }
        } else {
          const res = await fetch('/api/game/retry-topic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: state.room.id, topicAttempts }),
          });
          if (!res.ok) {
            console.error('[retry-topic]', await res.json().catch(() => ({})));
            proceedingRef.current = false;
            return;
          }
          setSelectedRole(null);
        }
      }
    } catch (err) {
      console.error('[topic proceed]', err);
      proceedingRef.current = false;
    }
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
