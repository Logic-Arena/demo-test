'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateRoomModal({ isOpen, onClose }: CreateRoomModalProps) {
  const [roomName, setRoomName] = useState('');
  const [nickname, setNickname] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  if (!isOpen) return null;

  if (!supabase) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 text-center">
          <p className="text-red-600 mb-4">Supabase 연결 설정이 필요합니다.</p>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roomName.trim() || !nickname.trim()) {
      setError('방 이름과 닉네임을 모두 입력해주세요.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // 현재 사용자 가져오기
      const { data: { user } } = await supabase.auth.getUser();

      // 방 생성
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          name: roomName.trim(),
          host_id: user?.id || null,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // 게임 상태 초기화
      const { error: gameStateError } = await supabase
        .from('game_states')
        .insert({
          room_id: room.id,
          phase: 'waiting',
        });

      if (gameStateError) throw gameStateError;

      // 호스트를 플레이어로 추가
      const { error: playerError } = await supabase
        .from('players')
        .insert({
          room_id: room.id,
          user_id: user?.id || null,
          nickname: nickname.trim(),
          is_ai: false,
        });

      if (playerError) throw playerError;

      // 닉네임을 로컬 스토리지에 저장
      localStorage.setItem('nickname', nickname.trim());
      localStorage.setItem(`room_${room.id}_joined`, 'true');

      // 방으로 이동
      router.push(`/room/${room.id}`);
    } catch (err) {
      setError((err as Error).message);
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">새 토론방 만들기</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 mb-1">
              방 이름
            </label>
            <input
              id="roomName"
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="예: AI 윤리 토론방"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
              maxLength={50}
            />
          </div>

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
              disabled={isCreating}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? '생성 중...' : '방 만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
