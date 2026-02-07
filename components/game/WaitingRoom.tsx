'use client';

import { useEffect, useMemo } from 'react';
import { useGame } from '@/contexts/GameContext';
import { createClient } from '@/lib/supabase/client';
import { Users, Clock, Loader2 } from 'lucide-react';
import { getRandomTopic } from '@/lib/gameLogic';

export function WaitingRoom() {
  const { state } = useGame();
  const supabase = useMemo(() => createClient(), []);
  const humanPlayers = state.players.filter(p => !p.isAi);

  useEffect(() => {
    // 2명이 모이면 리더(ID 정렬 첫 번째)만 게임 시작 호출 — 중복 AI 생성 방지
    const isLeader = state.currentPlayer
      && humanPlayers.length >= 2
      && [...humanPlayers].sort((a, b) => a.id.localeCompare(b.id))[0].id === state.currentPlayer.id;

    if (isLeader && state.gameState?.phase === 'waiting') {
      startGame();
    }
  }, [humanPlayers.length, state.gameState?.phase, state.currentPlayer]);

  const startGame = async () => {
    if (!state.room) return;

    // AI 플레이어 중복 생성 방지 — DB에서 직접 확인
    const { data: existingAi } = await supabase
      .from('players')
      .select('id')
      .eq('room_id', state.room.id)
      .eq('is_ai', true);

    if (!existingAi || existingAi.length === 0) {
      await supabase.from('players').insert([
        {
          room_id: state.room.id,
          nickname: '찬성AI',
          is_ai: true,
        },
        {
          room_id: state.room.id,
          nickname: '반대AI',
          is_ai: true,
        },
      ]);
    }

    // 게임 상태를 topic_selection으로 변경 — AI로 주제 생성, 실패 시 fallback
    let topic: string;
    try {
      const res = await fetch('/api/ai/topic', { method: 'POST' });
      const data = await res.json();
      topic = data.topic;
    } catch {
      topic = getRandomTopic();
    }
    const timerEndAt = new Date(Date.now() + 30 * 1000).toISOString();

    await supabase
      .from('game_states')
      .update({
        phase: 'topic_selection',
        topic,
        timer_end_at: timerEndAt,
        topic_attempts: 0,
      })
      .eq('room_id', state.room.id);

    // 방 상태를 playing으로 변경
    await supabase
      .from('rooms')
      .update({ status: 'playing' })
      .eq('id', state.room.id);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">대기 중</h2>
          <p className="text-gray-800">
            {humanPlayers.length < 2
              ? '상대방을 기다리고 있습니다...'
              : '게임을 시작하는 중...'}
          </p>
        </div>

        {/* Player List */}
        <div className="space-y-3 mb-8">
          <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
            참가자 ({humanPlayers.length}/2)
          </h3>
          
          {humanPlayers.map((player, index) => (
            <div
              key={player.id}
              className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg"
            >
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                {player.nickname.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{player.nickname}</p>
                <p className="text-sm text-gray-700">
                  {index === 0 ? '방장' : '참가자'}
                </p>
              </div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
          ))}

          {humanPlayers.length < 2 && (
            <div className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-200 rounded-lg">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
              <div className="flex-1">
                <p className="text-gray-700">대기 중...</p>
                <p className="text-sm text-gray-700">상대방을 기다리고 있습니다</p>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">게임 준비</p>
              <p className="text-sm text-blue-700">
                2명이 모이면 자동으로 게임이 시작됩니다.
                AI 파트너가 각 팀에 배정됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
