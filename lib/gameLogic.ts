import { GamePhase, PHASE_ORDER, PHASE_TIME_LIMITS, Player } from '@/types/game';

// 다음 페이즈 가져오기
export function getNextPhase(currentPhase: GamePhase): GamePhase | null {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  if (currentIndex === -1 || currentIndex === PHASE_ORDER.length - 1) {
    return null;
  }
  return PHASE_ORDER[currentIndex + 1];
}

// 타이머 종료 시간 계산
export function calculateTimerEndAt(phase: GamePhase): string | null {
  const timeLimit = PHASE_TIME_LIMITS[phase];
  if (!timeLimit) return null;
  
  const endAt = new Date(Date.now() + timeLimit * 1000);
  return endAt.toISOString();
}

// 현재 페이즈에서 발언해야 할 플레이어 결정
export function getCurrentTurnPlayer(
  phase: GamePhase,
  players: Player[]
): Player | null {
  const humanA = players.find(p => !p.isAi && p.role === 'pro');
  const humanB = players.find(p => !p.isAi && p.role === 'con');
  const aiA = players.find(p => p.isAi && p.role === 'pro');
  const aiB = players.find(p => p.isAi && p.role === 'con');

  switch (phase) {
    case 'phase0_claim':
      return null; // 모든 참가자가 동시에 작성
    case 'cycle1_humanA_rebuttal':
    case 'cycle1_humanA_counter':
      return humanA || null;
    case 'cycle1_conTeam_defense':
      return humanB || aiB || null;
    case 'cycle2_humanB_rebuttal':
    case 'cycle2_humanB_counter':
      return humanB || null;
    case 'cycle2_proTeam_defense':
      return humanA || aiA || null;
    case 'cycle3_aiA_rebuttal':
    case 'cycle3_aiA_counter':
      return aiA || null;
    case 'cycle3_conTeam_defense':
      return humanB || aiB || null;
    case 'cycle4_aiB_rebuttal':
    case 'cycle4_aiB_counter':
      return aiB || null;
    case 'cycle4_proTeam_defense':
      return humanA || aiA || null;
    case 'phase5_final':
      return null; // 모든 참가자가 동시에 작성
    default:
      return null;
  }
}

// AI 차례인지 확인
export function isAiTurn(phase: GamePhase): boolean {
  return (
    phase === 'cycle3_aiA_rebuttal' ||
    phase === 'cycle3_aiA_counter' ||
    phase === 'cycle4_aiB_rebuttal' ||
    phase === 'cycle4_aiB_counter'
  );
}

// 팀 변론 차례인지 확인 (여러 명이 발언 가능)
export function isTeamDefenseTurn(phase: GamePhase): boolean {
  return (
    phase === 'cycle1_conTeam_defense' ||
    phase === 'cycle2_proTeam_defense' ||
    phase === 'cycle3_conTeam_defense' ||
    phase === 'cycle4_proTeam_defense'
  );
}

// 동시 작성 페이즈인지 확인
export function isSimultaneousPhase(phase: GamePhase): boolean {
  return phase === 'phase0_claim' || phase === 'phase5_final';
}

// 이 페이즈에서 제출해야 할 플레이어 ID 목록 (전원 제출 시 다음 단계로 진행용)
export function getRequiredSubmitterIds(phase: GamePhase, players: Player[]): string[] {
  if (phase === 'waiting' || phase === 'topic_selection' || phase === 'judging' || phase === 'finished') {
    return [];
  }
  if (isSimultaneousPhase(phase)) {
    // role이 할당된 플레이어만 (중복 AI 방어)
    return players.filter(p => p.role === 'pro' || p.role === 'con').map(p => p.id);
  }
  if (isTeamDefenseTurn(phase)) {
    // 팀 전원 (인간 + AI)
    const teamRole = phase.includes('conTeam') ? 'con' : 'pro';
    return players.filter(p => p.role === teamRole).map(p => p.id);
  }
  const turnPlayer = getCurrentTurnPlayer(phase, players);
  return turnPlayer ? [turnPlayer.id] : [];
}

// 해당 페이즈에서 AI가 카드를 제출해야 하는 AI 플레이어 목록
export function getAiPlayersForPhase(phase: GamePhase, players: Player[]): Player[] {
  const aiA = players.find(p => p.isAi && p.role === 'pro');
  const aiB = players.find(p => p.isAi && p.role === 'con');

  switch (phase) {
    case 'phase0_claim':
    case 'phase5_final':
      return [aiA, aiB].filter(Boolean) as Player[];
    case 'cycle1_conTeam_defense':
    case 'cycle3_conTeam_defense':
      return aiB ? [aiB] : [];
    case 'cycle2_proTeam_defense':
    case 'cycle4_proTeam_defense':
      return aiA ? [aiA] : [];
    case 'cycle3_aiA_rebuttal':
    case 'cycle3_aiA_counter':
      return aiA ? [aiA] : [];
    case 'cycle4_aiB_rebuttal':
    case 'cycle4_aiB_counter':
      return aiB ? [aiB] : [];
    default:
      return [];
  }
}

// 토론 주제 생성 (AI가 제안할 주제 예시)
export const DEBATE_TOPICS = [
  '인공지능이 인간의 일자리를 대체하는 것은 바람직하다',
  '소셜 미디어는 사회에 해로운 영향을 끼친다',
  '대학 교육은 모든 사람에게 필수적이다',
  '원격 근무가 사무실 근무보다 생산성이 높다',
  '기본소득제 도입이 필요하다',
  '동물 실험은 과학 발전을 위해 필요하다',
  '사형제도는 폐지되어야 한다',
  '핵에너지 발전소 확대가 필요하다',
  '비트코인은 미래의 화폐가 될 것이다',
  '전 세계적인 영어 공용화가 필요하다',
];

export function getRandomTopic(): string {
  return DEBATE_TOPICS[Math.floor(Math.random() * DEBATE_TOPICS.length)];
}

// 역할 충돌 확인
export function hasRoleConflict(
  proSelection: string | null,
  conSelection: string | null
): boolean {
  // 둘 다 같은 역할을 선택했는지 확인
  if (!proSelection || !conSelection) return false;
  return proSelection === conSelection;
}

// 팀 구성 생성
export function assignTeams(
  player1Id: string,
  player2Id: string,
  player1Role: 'pro' | 'con',
  player2Role: 'pro' | 'con'
): { player1Team: 'A' | 'B'; player2Team: 'A' | 'B' } {
  // 찬성 선택한 플레이어가 팀 A, 반대 선택한 플레이어가 팀 B
  if (player1Role === 'pro') {
    return { player1Team: 'A', player2Team: 'B' };
  } else {
    return { player1Team: 'B', player2Team: 'A' };
  }
}

// 시간을 mm:ss 형식으로 변환
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 카드 색상 결정 (역할에 따라)
export function getCardColor(role: 'pro' | 'con' | null): string {
  if (role === 'pro') return 'bg-blue-50 border-blue-200';
  if (role === 'con') return 'bg-red-50 border-red-200';
  return 'bg-gray-50 border-gray-200';
}

// 플레이어 표시 이름 생성
export function getPlayerDisplayName(player: Player): string {
  if (player.isAi) {
    return player.role === 'pro' ? '찬성AI' : '반대AI';
  }
  if (player.role === 'spectator') {
    return `${player.nickname} (관전)`;
  }
  return `${player.nickname} (${player.role === 'pro' ? '찬성' : '반대'})`;
}
