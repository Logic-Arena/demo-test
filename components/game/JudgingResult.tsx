'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/contexts/GameContext';
import { Trophy, Medal, MessageSquare, BarChart3, Loader2, Home, RotateCcw } from 'lucide-react';

export function JudgingResult() {
  const { state, requestJudgment } = useGame();
  const router = useRouter();
  const [isJudging, setIsJudging] = useState(false);

  const { judgment, players, gameState, cards } = state;

  useEffect(() => {
    // 판정 중 상태이고 아직 판정이 없으면 판정 요청
    if (gameState?.phase === 'judging' && !judgment && !isJudging) {
      setIsJudging(true);
      requestJudgment().finally(() => setIsJudging(false));
    }
  }, [gameState?.phase, judgment, isJudging, requestJudgment]);

  const getPlayerById = (playerId: string) => 
    players.find(p => p.id === playerId);

  // 판정 중
  if (!judgment || gameState?.phase === 'judging') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
            <Loader2 className="w-10 h-10 text-yellow-600 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">AI 심판이 분석 중입니다</h2>
          <p className="text-gray-800 mb-2">
            전체 토론 내용을 검토하고 있습니다.
          </p>
          <p className="text-sm text-gray-700">
            잠시만 기다려 주세요...
          </p>

          {/* 토론 통계 */}
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{cards.length}</p>
              <p className="text-sm text-gray-700">총 발언 수</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {cards.filter(c => getPlayerById(c.playerId)?.role === 'pro').length}
              </p>
              <p className="text-sm text-gray-700">찬성팀 발언</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">
                {cards.filter(c => getPlayerById(c.playerId)?.role === 'con').length}
              </p>
              <p className="text-sm text-gray-700">반대팀 발언</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 승자 팀 정보
  const winnerDisplay = {
    pro: { label: '찬성팀 승리!', color: 'text-blue-600', bg: 'bg-blue-100' },
    con: { label: '반대팀 승리!', color: 'text-red-600', bg: 'bg-red-100' },
    draw: { label: '무승부!', color: 'text-gray-600', bg: 'bg-gray-100' },
  }[judgment.winnerTeam];

  // 점수 순으로 플레이어 정렬
  const sortedPlayers = [...players].sort((a, b) => {
    const scoreA = judgment.scores[a.id] || 0;
    const scoreB = judgment.scores[b.id] || 0;
    return scoreB - scoreA;
  });

  return (
    <div className="max-w-3xl mx-auto">
      {/* Winner Banner */}
      <div className={`${winnerDisplay.bg} rounded-2xl p-8 text-center mb-6`}>
        <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4">
          <Trophy className={`w-10 h-10 ${winnerDisplay.color}`} />
        </div>
        <h1 className={`text-3xl font-bold ${winnerDisplay.color} mb-2`}>
          {winnerDisplay.label}
        </h1>
        <p className="text-gray-800">
          토론 주제: &ldquo;{state.gameState?.topic}&rdquo;
        </p>
      </div>

      {/* Scores */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">개인 점수</h2>
        </div>

        <div className="space-y-3">
          {sortedPlayers.map((player, index) => {
            const score = judgment.scores[player.id] || 0;
            const isPro = player.role === 'pro';
            
            return (
              <div
                key={player.id}
                className={`flex items-center gap-4 p-4 rounded-lg ${
                  isPro ? 'bg-blue-50' : 'bg-red-50'
                }`}
              >
                <div className="flex items-center justify-center w-8 h-8">
                  {index === 0 && <Medal className="w-6 h-6 text-yellow-500" />}
                  {index === 1 && <Medal className="w-6 h-6 text-gray-400" />}
                  {index === 2 && <Medal className="w-6 h-6 text-amber-600" />}
                  {index > 2 && <span className="text-gray-700 font-medium">{index + 1}</span>}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{player.nickname}</span>
                    {player.isAi && (
                      <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                        AI
                      </span>
                    )}
                    <span className={`text-sm ${isPro ? 'text-blue-600' : 'text-red-600'}`}>
                      {isPro ? '찬성' : '반대'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-bold text-gray-900">{score}</span>
                  <span className="text-gray-700">/100</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Individual Feedback */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">개인별 피드백</h2>
        </div>

        <div className="space-y-4">
          {players.map((player) => {
            const feedback = judgment.feedback[player.id];
            const isPro = player.role === 'pro';
            
            if (!feedback) return null;
            
            return (
              <div
                key={player.id}
                className={`p-4 rounded-lg border-l-4 ${
                  isPro ? 'border-blue-500 bg-blue-50' : 'border-red-500 bg-red-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-gray-900">{player.nickname}</span>
                  {player.isAi && (
                    <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                      AI
                    </span>
                  )}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{feedback}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overall Analysis */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">전체 토론 분석</h2>
        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
          {judgment.overallAnalysis}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={() => router.push('/')}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Home className="w-5 h-5" />
          <span>로비로 돌아가기</span>
        </button>
        <button
          onClick={() => window.location.reload()}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
          <span>새 게임 시작</span>
        </button>
      </div>
    </div>
  );
}
