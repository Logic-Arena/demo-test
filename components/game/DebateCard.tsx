'use client';

import { DebateCard as DebateCardType, Player } from '@/types/game';
import { Bot, User } from 'lucide-react';

interface DebateCardProps {
  card: DebateCardType;
  player: Player | undefined;
  isHighlighted?: boolean;
}

export function DebateCard({ card, player, isHighlighted = false }: DebateCardProps) {
  if (!player) return null;

  const isPro = player.role === 'pro';
  const isAi = player.isAi;

  return (
    <div
      className={`rounded-xl border-2 p-4 transition-all ${
        isHighlighted ? 'ring-2 ring-offset-2' : ''
      } ${
        isPro
          ? `bg-blue-50 border-blue-200 ${isHighlighted ? 'ring-blue-400' : ''}`
          : `bg-red-50 border-red-200 ${isHighlighted ? 'ring-red-400' : ''}`
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isPro ? 'bg-blue-500' : 'bg-red-500'
          }`}
        >
          {isAi ? (
            <Bot className="w-5 h-5 text-white" />
          ) : (
            <User className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">
              {player.nickname}
            </span>
            {isAi && (
              <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">
                AI
              </span>
            )}
          </div>
          <span className={`text-sm ${isPro ? 'text-blue-600' : 'text-red-600'}`}>
            {isPro ? '찬성' : '반대'}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(card.createdAt).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* Content */}
      <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
        {card.content}
      </div>
    </div>
  );
}
