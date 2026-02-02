'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Room } from '@/types/game';
import { Users, Clock, ArrowRight } from 'lucide-react';

interface RoomWithPlayerCount extends Room {
  playerCount: number;
}

export function RoomList() {
  const [rooms, setRooms] = useState<RoomWithPlayerCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setError('Supabase 연결 설정이 필요합니다.');
      setIsLoading(false);
      return;
    }

    loadRooms();

    // 실시간 구독 (Supabase Replication 활성화 시 즉시 반영)
    const channel = supabase
      .channel('rooms-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
        },
        () => {
          loadRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const loadRooms = async () => {
    if (!supabase) return;

    const { data: roomsData, error: fetchError } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('방 목록 로드 실패:', fetchError);
      setIsLoading(false);
      return;
    }

    // 각 방의 플레이어 수 가져오기
    const roomsWithCount = await Promise.all(
      (roomsData || []).map(async (room) => {
        const { count } = await supabase
          .from('players')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', room.id)
          .eq('is_ai', false);

        return {
          id: room.id,
          name: room.name,
          status: room.status as 'waiting' | 'playing' | 'finished',
          createdAt: room.created_at,
          hostId: room.host_id,
          playerCount: count || 0,
        };
      })
    );

    setRooms(roomsWithCount);
    setIsLoading(false);
  };

  const handleJoinRoom = (roomId: string) => {
    router.push(`/room/${roomId}`);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    return `${Math.floor(diffHours / 24)}일 전`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-2">{error}</p>
        <p className="text-sm text-gray-700">.env.local 파일에 Supabase 설정을 확인해주세요.</p>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">현재 대기 중인 방이 없습니다.</p>
        <p className="text-sm text-gray-700">새로운 방을 만들어 토론을 시작하세요!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rooms.map((room) => (
        <div
          key={room.id}
          className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
          onClick={() => handleJoinRoom(room.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{room.name}</h3>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-700">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {room.playerCount}/2
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatTime(room.createdAt)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {room.playerCount < 2 ? (
                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full">
                  참가 가능
                </span>
              ) : (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm rounded-full">
                  관전만 가능
                </span>
              )}
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
