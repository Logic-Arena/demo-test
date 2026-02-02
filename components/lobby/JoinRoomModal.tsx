'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  onJoined: () => void;
}

export function JoinRoomModal({ isOpen, onClose, roomId, roomName, onJoined }: JoinRoomModalProps) {
  const [nickname, setNickname] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nickname') || '';
    }
    return '';
  });
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  if (!isOpen) return null;

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 이미 참가했는지 확인
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', user?.id)
        .single();

      if (existingPlayer) {
        // 이미 참가한 경우 닉네임만 업데이트
        await supabase
          .from('players')
          .update({ nickname: nickname.trim() })
          .eq('id', existingPlayer.id);
      } else {
        // 새로 참가
        const { error: playerError } = await supabase
          .from('players')
          .insert({
            room_id: roomId,
            user_id: user?.id || null,
            nickname: nickname.trim(),
            is_ai: false,
          });

        if (playerError) throw playerError;
      }

      // 닉네임을 로컬 스토리지에 저장
      localStorage.setItem('nickname', nickname.trim());
      localStorage.setItem(`room_${roomId}_joined`, 'true');

      onJoined();
    } catch (err) {
      setError((err as Error).message);
      setIsJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">토론방 참가</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleJoin} className="p-4 space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">참가할 방</p>
            <p className="font-medium">{roomName}</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
              닉네임
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="토론에서 사용할 닉네임"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
              maxLength={20}
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isJoining}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? '참가 중...' : '참가하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
