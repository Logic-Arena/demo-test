'use client';

import { Player } from '@/types/game';
import { Bot, User, ThumbsUp, ThumbsDown } from 'lucide-react';

interface TeamSidebarProps {
  team: 'pro' | 'con';
  players: Player[];
  currentTurnPlayerId: string | undefined;
  compact?: boolean;
}

export function TeamSidebar({ team, players, currentTurnPlayerId, compact = false }: TeamSidebarProps) {
  const isPro = team === 'pro';
  
  const bgColor = isPro ? 'bg-blue-50' : 'bg-red-50';
  const borderColor = isPro ? 'border-blue-200' : 'border-red-200';
  const textColor = isPro ? 'text-blue-700' : 'text-red-700';
  const accentColor = isPro ? 'bg-blue-500' : 'bg-red-500';

  if (compact) {
    return (
      <div className={`rounded-lg border ${borderColor} ${bgColor} p-3`}>
        <div className="flex items-center gap-2 mb-2">
          {isPro ? (
            <ThumbsUp className={`w-4 h-4 ${textColor}`} />
          ) : (
            <ThumbsDown className={`w-4 h-4 ${textColor}`} />
          )}
          <span className={`text-sm font-medium ${textColor}`}>
            {isPro ? '찬성팀' : '반대팀'}
          </span>
        </div>
        <div className="space-y-1">
          {players.map((player) => (
            <div 
              key={player.id}
              className={`flex items-center gap-2 text-sm ${
                currentTurnPlayerId === player.id ? 'font-bold' : ''
              }`}
            >
              {player.isAi ? (
                <Bot className="w-3 h-3" />
              ) : (
                <User className="w-3 h-3" />
              )}
              <span className="truncate">{player.nickname}</span>
              {currentTurnPlayerId === player.id && (
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} overflow-hidden`}>
      {/* Header */}
      <div className={`${accentColor} text-white px-4 py-3`}>
        <div className="flex items-center gap-2">
          {isPro ? (
            <ThumbsUp className="w-5 h-5" />
          ) : (
            <ThumbsDown className="w-5 h-5" />
          )}
          <span className="font-semibold">
            {isPro ? '찬성팀 (Pro)' : '반대팀 (Con)'}
          </span>
        </div>
      </div>

      {/* Players */}
      <div className="p-3 space-y-2">
        {players.map((player) => (
          <div
            key={player.id}
            className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
              currentTurnPlayerId === player.id
                ? 'bg-white shadow-sm'
                : 'hover:bg-white/50'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${accentColor}`}
            >
              {player.isAi ? (
                <Bot className="w-5 h-5 text-white" />
              ) : (
                <User className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 truncate">
                  {player.nickname}
                </span>
                {player.isAi && (
                  <span className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                    AI
                  </span>
                )}
              </div>
              {currentTurnPlayerId === player.id && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  발언 중
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
