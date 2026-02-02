// 게임 페이즈 타입
export type GamePhase =
  | 'waiting'
  | 'topic_selection'
  | 'phase0_claim'
  | 'cycle1_humanA_rebuttal'
  | 'cycle1_conTeam_defense'
  | 'cycle1_humanA_counter'
  | 'cycle2_humanB_rebuttal'
  | 'cycle2_proTeam_defense'
  | 'cycle2_humanB_counter'
  | 'cycle3_aiA_rebuttal'
  | 'cycle3_conTeam_defense'
  | 'cycle3_aiA_counter'
  | 'cycle4_aiB_rebuttal'
  | 'cycle4_proTeam_defense'
  | 'cycle4_aiB_counter'
  | 'phase5_final'
  | 'judging'
  | 'finished';

// 역할 타입
export type Role = 'pro' | 'con';

// 팀 타입
export type Team = 'A' | 'B';

// 방 상태 타입
export type RoomStatus = 'waiting' | 'playing' | 'finished';

// 플레이어 인터페이스
export interface Player {
  id: string;
  roomId: string;
  userId: string | null;
  nickname: string;
  role: Role | null;
  isAi: boolean;
  team: Team | null;
  joinedAt: string;
}

// 방 인터페이스
export interface Room {
  id: string;
  name: string;
  status: RoomStatus;
  createdAt: string;
  hostId: string | null;
}

// 토론 카드 인터페이스
export interface DebateCard {
  id: string;
  roomId: string;
  playerId: string;
  phase: GamePhase;
  subPhase: string | null;
  content: string;
  createdAt: string;
}

// 게임 상태 인터페이스
export interface GameState {
  id: string;
  roomId: string;
  phase: GamePhase;
  subPhase: string | null;
  currentTurn: string | null;
  topic: string | null;
  topicAttempts: number;
  timerEndAt: string | null;
  proSelection: string | null;
  conSelection: string | null;
  updatedAt: string;
}

// 판정 결과 인터페이스
export interface Judgment {
  id: string;
  roomId: string;
  winnerTeam: 'pro' | 'con' | 'draw';
  scores: Record<string, number>;
  feedback: Record<string, string>;
  overallAnalysis: string;
  createdAt: string;
}

// 게임 컨텍스트에서 사용할 전체 상태
export interface FullGameState {
  room: Room | null;
  players: Player[];
  gameState: GameState | null;
  cards: DebateCard[];
  judgment: Judgment | null;
  currentPlayer: Player | null;
  isLoading: boolean;
  error: string | null;
}

// 페이즈별 시간 제한 (초)
export const PHASE_TIME_LIMITS: Partial<Record<GamePhase, number>> = {
  topic_selection: 10,
  phase0_claim: 120, // 2분
  cycle1_humanA_rebuttal: 120,
  cycle1_conTeam_defense: 90,
  cycle1_humanA_counter: 60,
  cycle2_humanB_rebuttal: 90,
  cycle2_proTeam_defense: 90,
  cycle2_humanB_counter: 60,
  cycle3_aiA_rebuttal: 10, // AI 자동 생성
  cycle3_conTeam_defense: 90,
  cycle3_aiA_counter: 60,
  cycle4_aiB_rebuttal: 10, // AI 자동 생성
  cycle4_proTeam_defense: 90,
  cycle4_aiB_counter: 60,
  phase5_final: 60,
};

// 페이즈 순서
export const PHASE_ORDER: GamePhase[] = [
  'waiting',
  'topic_selection',
  'phase0_claim',
  'cycle1_humanA_rebuttal',
  'cycle1_conTeam_defense',
  'cycle1_humanA_counter',
  'cycle2_humanB_rebuttal',
  'cycle2_proTeam_defense',
  'cycle2_humanB_counter',
  'cycle3_aiA_rebuttal',
  'cycle3_conTeam_defense',
  'cycle3_aiA_counter',
  'cycle4_aiB_rebuttal',
  'cycle4_proTeam_defense',
  'cycle4_aiB_counter',
  'phase5_final',
  'judging',
  'finished',
];

// 페이즈 표시 이름
export const PHASE_DISPLAY_NAMES: Record<GamePhase, string> = {
  waiting: '대기 중',
  topic_selection: '주제 선택',
  phase0_claim: '주장 작성',
  cycle1_humanA_rebuttal: '사람A 반론',
  cycle1_conTeam_defense: '반대측 변론',
  cycle1_humanA_counter: '사람A 재반론',
  cycle2_humanB_rebuttal: '사람B 반론',
  cycle2_proTeam_defense: '찬성측 변론',
  cycle2_humanB_counter: '사람B 재반론',
  cycle3_aiA_rebuttal: 'AI_A 반론',
  cycle3_conTeam_defense: '반대측 변론',
  cycle3_aiA_counter: 'AI_A 재반론',
  cycle4_aiB_rebuttal: 'AI_B 반론',
  cycle4_proTeam_defense: '찬성측 변론',
  cycle4_aiB_counter: 'AI_B 재반론',
  phase5_final: '최종 의견',
  judging: '판정 중',
  finished: '게임 종료',
};

// Database 타입 (Supabase에서 사용)
export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          name: string;
          status: string;
          created_at: string;
          host_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          status?: string;
          created_at?: string;
          host_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          status?: string;
          created_at?: string;
          host_id?: string | null;
        };
      };
      players: {
        Row: {
          id: string;
          room_id: string;
          user_id: string | null;
          nickname: string;
          role: string | null;
          is_ai: boolean;
          team: string | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id?: string | null;
          nickname: string;
          role?: string | null;
          is_ai?: boolean;
          team?: string | null;
          joined_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string | null;
          nickname?: string;
          role?: string | null;
          is_ai?: boolean;
          team?: string | null;
          joined_at?: string;
        };
      };
      game_states: {
        Row: {
          id: string;
          room_id: string;
          phase: string;
          sub_phase: string | null;
          current_turn: string | null;
          topic: string | null;
          topic_attempts: number;
          timer_end_at: string | null;
          pro_selection: string | null;
          con_selection: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          phase: string;
          sub_phase?: string | null;
          current_turn?: string | null;
          topic?: string | null;
          topic_attempts?: number;
          timer_end_at?: string | null;
          pro_selection?: string | null;
          con_selection?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          phase?: string;
          sub_phase?: string | null;
          current_turn?: string | null;
          topic?: string | null;
          topic_attempts?: number;
          timer_end_at?: string | null;
          pro_selection?: string | null;
          con_selection?: string | null;
          updated_at?: string;
        };
      };
      debate_cards: {
        Row: {
          id: string;
          room_id: string;
          player_id: string;
          phase: string;
          sub_phase: string | null;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          player_id: string;
          phase: string;
          sub_phase?: string | null;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          player_id?: string;
          phase?: string;
          sub_phase?: string | null;
          content?: string;
          created_at?: string;
        };
      };
      judgments: {
        Row: {
          id: string;
          room_id: string;
          winner_team: string;
          scores: Record<string, number>;
          feedback: Record<string, string>;
          overall_analysis: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          winner_team: string;
          scores: Record<string, number>;
          feedback: Record<string, string>;
          overall_analysis: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          winner_team?: string;
          scores?: Record<string, number>;
          feedback?: Record<string, string>;
          overall_analysis?: string;
          created_at?: string;
        };
      };
    };
  };
}
