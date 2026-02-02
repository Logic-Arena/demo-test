'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GameProvider, useGame } from '@/contexts/GameContext';
import { JoinRoomModal } from '@/components/lobby/JoinRoomModal';
import { TopicSelection } from '@/components/game/TopicSelection';
import { DebateArena } from '@/components/game/DebateArena';
import { JudgingResult } from '@/components/game/JudgingResult';
import { WaitingRoom } from '@/components/game/WaitingRoom';
import { ArrowLeft, Loader2 } from 'lucide-react';

function RoomContent() {
  const { state } = useGame();
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    // 이미 참가했는지 확인
    const checkJoined = async () => {
      const localJoined = localStorage.getItem(`room_${roomId}_joined`);
      if (localJoined) {
        setHasJoined(true);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .single();

        if (data) {
          setHasJoined(true);
          localStorage.setItem(`room_${roomId}_joined`, 'true');
          return;
        }
      }

      // 참가하지 않은 경우 모달 표시
      setShowJoinModal(true);
    };

    checkJoined();
  }, [roomId, supabase]);

  const handleJoined = () => {
    setHasJoined(true);
    setShowJoinModal(false);
  };

  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600">방 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-4 text-center">
          <p className="text-red-600 mb-4">{state.error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            로비로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!state.room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-4 text-center">
          <p className="text-gray-600 mb-4">방을 찾을 수 없습니다.</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            로비로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const renderGameContent = () => {
    const phase = state.gameState?.phase || 'waiting';

    switch (phase) {
      case 'waiting':
        return <WaitingRoom />;
      case 'topic_selection':
        return <TopicSelection />;
      case 'judging':
      case 'finished':
        return <JudgingResult />;
      default:
        return <DebateArena />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="font-semibold text-gray-900">{state.room.name}</h1>
                <p className="text-xs text-gray-500">
                  참가자: {state.players.filter(p => !p.isAi).length}/2
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {renderGameContent()}
      </main>

      {/* Join Modal */}
      <JoinRoomModal
        isOpen={showJoinModal && !hasJoined}
        onClose={() => router.push('/')}
        roomId={roomId}
        roomName={state.room.name}
        onJoined={handleJoined}
      />
    </div>
  );
}

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  return (
    <GameProvider roomId={roomId}>
      <RoomContent />
    </GameProvider>
  );
}
