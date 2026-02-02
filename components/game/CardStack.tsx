'use client';

import { DebateCard as DebateCardType, Player, GamePhase, PHASE_DISPLAY_NAMES } from '@/types/game';
import { DebateCard } from './DebateCard';

interface CardStackProps {
  cards: DebateCardType[];
  players: Player[];
  currentPhase: GamePhase;
}

export function CardStack({ cards, players, currentPhase }: CardStackProps) {
  // 카드를 페이즈별로 그룹화
  const groupedCards = cards.reduce((acc, card) => {
    if (!acc[card.phase]) {
      acc[card.phase] = [];
    }
    acc[card.phase].push(card);
    return acc;
  }, {} as Record<string, DebateCardType[]>);

  const getPlayerById = (playerId: string) => 
    players.find(p => p.id === playerId);

  if (cards.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        아직 제출된 카드가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedCards).map(([phase, phaseCards]) => (
        <div key={phase}>
          {/* Phase Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-sm font-medium text-gray-500 px-3 py-1 bg-gray-100 rounded-full">
              {PHASE_DISPLAY_NAMES[phase as GamePhase] || phase}
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Cards */}
          <div className="space-y-3">
            {phaseCards.map((card) => (
              <DebateCard
                key={card.id}
                card={card}
                player={getPlayerById(card.playerId)}
                isHighlighted={card.phase === currentPhase}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
