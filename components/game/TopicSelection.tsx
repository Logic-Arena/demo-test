'use client';

import { useState, useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { ThumbsUp, ThumbsDown, AlertCircle, Shuffle } from 'lucide-react';

export function TopicSelection() {
  const { state } = useGame();
  const [selectedRole, setSelectedRole] = useState<'pro' | 'con' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // topic 변경 시 UI 초기화
  useEffect(() => {
    setSelectedRole(null);
    setIsSubmitting(false);
    setStatusMessage(null);
  }, [state.gameState?.topic]);

  const handleSelect = async (role: 'pro' | 'con') => {
    if (isSubmitting || selectedRole) return;
    if (!state.room || !state.currentPlayer) return;

    setIsSubmitting(true);
    setSelectedRole(role);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/game/select-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: state.room.id,
          playerId: state.currentPlayer.id,
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('[select-role]', data.error);
        setSelectedRole(null);
        setStatusMessage('오류가 발생했습니다. 다시 시도해주세요.');
        return;
      }

      // status에 따라 UI 메시지 표시
      switch (data.status) {
        case 'waiting':
          setStatusMessage('상대방의 선택을 기다리는 중...');
          break;
        case 'started':
          if (data.random) {
            setStatusMessage('랜덤으로 역할이 배정되었습니다. 곧 토론이 시작됩니다!');
          } else {
            setStatusMessage('역할이 확정되었습니다. 곧 토론이 시작됩니다!');
          }
          break;
        case 'retry':
          setStatusMessage('선택이 겹쳤습니다. 새로운 주제가 제시됩니다.');
          // retry 시 selectedRole은 topic 변경 useEffect에서 초기화됨
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('역할 선택 실패:', error);
      setSelectedRole(null);
      setStatusMessage('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const topicAttempts = state.gameState?.topicAttempts || 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
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
        {(selectedRole || statusMessage) && (
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-800">
              {statusMessage || (
                <>
                  <span className={selectedRole === 'pro' ? 'text-blue-600' : 'text-red-600'}>
                    {selectedRole === 'pro' ? '찬성' : '반대'}
                  </span>
                  을 선택했습니다. 상대방의 선택을 기다리는 중...
                </>
              )}
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
