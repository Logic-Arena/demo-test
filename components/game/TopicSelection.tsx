'use client';

import { useState, useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { ThumbsUp, ThumbsDown, AlertCircle, Shuffle, Check } from 'lucide-react';

export function TopicSelection() {
  const { state } = useGame();
  const [pendingRole, setPendingRole] = useState<'pro' | 'con' | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // topic 변경 시 UI 초기화
  useEffect(() => {
    setPendingRole(null);
    setIsSubmitted(false);
    setIsSubmitting(false);
    setStatusMessage(null);
  }, [state.gameState?.topic]);

  const handleRoleClick = (role: 'pro' | 'con') => {
    if (isSubmitted || isSubmitting) return;
    setPendingRole(role);
  };

  const handleSubmit = async () => {
    if (!pendingRole || isSubmitting || isSubmitted) return;
    if (!state.room || !state.currentPlayer) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/game/select-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: state.room.id,
          playerId: state.currentPlayer.id,
          role: pendingRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('[select-role]', data.error);
        setStatusMessage('오류가 발생했습니다. 다시 시도해주세요.');
        setIsSubmitting(false);
        return;
      }

      // 제출 성공
      setIsSubmitted(true);

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
          setIsSubmitted(false);
          setPendingRole(null);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('역할 선택 실패:', error);
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
            찬성 또는 반대를 선택한 후 선택 완료 버튼을 눌러주세요.
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
            onClick={() => handleRoleClick('pro')}
            disabled={isSubmitted || isSubmitting}
            className={`p-6 rounded-xl border-2 transition-all ${
              pendingRole === 'pro'
                ? 'border-blue-500 bg-blue-50'
                : isSubmitted
                ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={`p-3 rounded-full ${
                pendingRole === 'pro' ? 'bg-blue-500' : 'bg-blue-100'
              }`}>
                <ThumbsUp className={`w-6 h-6 ${
                  pendingRole === 'pro' ? 'text-white' : 'text-blue-600'
                }`} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">찬성</p>
                <p className="text-sm text-gray-700">Pro</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleRoleClick('con')}
            disabled={isSubmitted || isSubmitting}
            className={`p-6 rounded-xl border-2 transition-all ${
              pendingRole === 'con'
                ? 'border-red-500 bg-red-50'
                : isSubmitted
                ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                : 'border-gray-200 hover:border-red-300 hover:bg-red-50 cursor-pointer'
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={`p-3 rounded-full ${
                pendingRole === 'con' ? 'bg-red-500' : 'bg-red-100'
              }`}>
                <ThumbsDown className={`w-6 h-6 ${
                  pendingRole === 'con' ? 'text-white' : 'text-red-600'
                }`} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">반대</p>
                <p className="text-sm text-gray-700">Con</p>
              </div>
            </div>
          </button>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!pendingRole || isSubmitting || isSubmitted}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 ${
            !pendingRole || isSubmitted
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : isSubmitting
              ? 'bg-green-400 text-white cursor-wait'
              : 'bg-green-500 hover:bg-green-600 text-white cursor-pointer'
          }`}
        >
          <Check className="w-5 h-5" />
          {isSubmitting ? '제출 중...' : isSubmitted ? '선택 완료됨' : '선택 완료'}
        </button>

        {/* Selection Status */}
        {statusMessage && (
          <div className="mt-4 text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-800">{statusMessage}</p>
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
