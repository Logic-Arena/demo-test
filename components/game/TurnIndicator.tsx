'use client';

import { Player, GamePhase, PHASE_DISPLAY_NAMES } from '@/types/game';
import { isSimultaneousPhase, isTeamDefenseTurn, isAiTurn } from '@/lib/gameLogic';
import { Bot, User, Users } from 'lucide-react';

interface TurnIndicatorProps {
  phase: GamePhase;
  currentTurnPlayer: Player | null;
  players: Player[];
  isMyTurn: boolean;
}

export function TurnIndicator({ phase, currentTurnPlayer, players, isMyTurn }: TurnIndicatorProps) {
  const getIndicatorContent = () => {
    if (isSimultaneousPhase(phase)) {
      return {
        icon: <Users className="w-5 h-5" />,
        title: '모두의 차례',
        description: '모든 참가자가 동시에 작성합니다',
        color: 'bg-purple-100 text-purple-700 border-purple-200',
      };
    }

    if (isTeamDefenseTurn(phase)) {
      const teamRole = phase.includes('conTeam') ? 'con' : 'pro';
      const teamPlayers = players.filter(p => p.role === teamRole);
      return {
        icon: <Users className="w-5 h-5" />,
        title: `${teamRole === 'pro' ? '찬성' : '반대'}팀 변론`,
        description: teamPlayers.map(p => p.nickname).join(', '),
        color: teamRole === 'pro' 
          ? 'bg-blue-100 text-blue-700 border-blue-200'
          : 'bg-red-100 text-red-700 border-red-200',
      };
    }

    if (isAiTurn(phase)) {
      return {
        icon: <Bot className="w-5 h-5" />,
        title: 'AI 차례',
        description: currentTurnPlayer?.nickname || 'AI가 응답을 생성 중...',
        color: 'bg-gray-100 text-gray-700 border-gray-200',
      };
    }

    if (currentTurnPlayer) {
      const isPro = currentTurnPlayer.role === 'pro';
      return {
        icon: currentTurnPlayer.isAi ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />,
        title: isMyTurn ? '내 차례!' : `${currentTurnPlayer.nickname}의 차례`,
        description: PHASE_DISPLAY_NAMES[phase],
        color: isPro
          ? 'bg-blue-100 text-blue-700 border-blue-200'
          : 'bg-red-100 text-red-700 border-red-200',
      };
    }

    return {
      icon: <User className="w-5 h-5" />,
      title: PHASE_DISPLAY_NAMES[phase],
      description: '대기 중',
      color: 'bg-gray-100 text-gray-700 border-gray-200',
    };
  };

  const content = getIndicatorContent();

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${content.color}`}>
      <div className="p-2 bg-white/50 rounded-full">
        {content.icon}
      </div>
      <div className="flex-1">
        <p className="font-semibold">{content.title}</p>
        <p className="text-sm opacity-80">{content.description}</p>
      </div>
      {isMyTurn && (
        <div className="px-3 py-1 bg-white rounded-full text-sm font-medium animate-pulse">
          작성하세요
        </div>
      )}
    </div>
  );
}
