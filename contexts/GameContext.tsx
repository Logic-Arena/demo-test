'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  FullGameState,
  Room,
  Player,
  GameState,
  DebateCard,
  Judgment,
  GamePhase,
} from '@/types/game';
import { calculateTimerEndAt, getNextPhase, getRandomTopic } from '@/lib/gameLogic';

// 액션 타입
type GameAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ROOM'; payload: Room | null }
  | { type: 'SET_PLAYERS'; payload: Player[] }
  | { type: 'ADD_PLAYER'; payload: Player }
  | { type: 'UPDATE_PLAYER'; payload: Player }
  | { type: 'REMOVE_PLAYER'; payload: string }
  | { type: 'SET_GAME_STATE'; payload: GameState | null }
  | { type: 'SET_CARDS'; payload: DebateCard[] }
  | { type: 'ADD_CARD'; payload: DebateCard }
  | { type: 'SET_JUDGMENT'; payload: Judgment | null }
  | { type: 'SET_CURRENT_PLAYER'; payload: Player | null }
  | { type: 'RESET' };

// 초기 상태
const initialState: FullGameState = {
  room: null,
  players: [],
  gameState: null,
  cards: [],
  judgment: null,
  currentPlayer: null,
  isLoading: true,
  error: null,
};

// 리듀서
function gameReducer(state: FullGameState, action: GameAction): FullGameState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_ROOM':
      return { ...state, room: action.payload };
    case 'SET_PLAYERS':
      return { ...state, players: action.payload };
    case 'ADD_PLAYER':
      return { ...state, players: [...state.players, action.payload] };
    case 'UPDATE_PLAYER':
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      };
    case 'REMOVE_PLAYER':
      return {
        ...state,
        players: state.players.filter((p) => p.id !== action.payload),
      };
    case 'SET_GAME_STATE':
      return { ...state, gameState: action.payload };
    case 'SET_CARDS':
      return { ...state, cards: action.payload };
    case 'ADD_CARD':
      return { ...state, cards: [...state.cards, action.payload] };
    case 'SET_JUDGMENT':
      return { ...state, judgment: action.payload };
    case 'SET_CURRENT_PLAYER':
      return { ...state, currentPlayer: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// Context 타입
interface GameContextType {
  state: FullGameState;
  // Room actions
  joinRoom: (roomId: string, nickname: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  // Topic selection actions
  selectRole: (role: 'pro' | 'con') => Promise<void>;
  // Debate actions
  submitCard: (content: string) => Promise<void>;
  // Phase management
  advancePhase: () => Promise<void>;
  // AI actions
  triggerAiResponse: () => Promise<void>;
  // Judging
  requestJudgment: () => Promise<void>;
}

const GameContext = createContext<GameContextType | null>(null);

// DB 로우를 앱 타입으로 변환하는 유틸리티
function mapPlayerFromDb(row: Record<string, unknown>): Player {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    userId: row.user_id as string | null,
    nickname: row.nickname as string,
    role: row.role as 'pro' | 'con' | null,
    isAi: row.is_ai as boolean,
    team: row.team as 'A' | 'B' | null,
    joinedAt: row.joined_at as string,
  };
}

function mapGameStateFromDb(row: Record<string, unknown>): GameState {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    phase: row.phase as GamePhase,
    subPhase: row.sub_phase as string | null,
    currentTurn: row.current_turn as string | null,
    topic: row.topic as string | null,
    topicAttempts: row.topic_attempts as number,
    timerEndAt: row.timer_end_at as string | null,
    proSelection: row.pro_selection as string | null,
    conSelection: row.con_selection as string | null,
    updatedAt: row.updated_at as string,
  };
}

function mapCardFromDb(row: Record<string, unknown>): DebateCard {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    playerId: row.player_id as string,
    phase: row.phase as GamePhase,
    subPhase: row.sub_phase as string | null,
    content: row.content as string,
    createdAt: row.created_at as string,
  };
}

function mapRoomFromDb(row: Record<string, unknown>): Room {
  return {
    id: row.id as string,
    name: row.name as string,
    status: row.status as 'waiting' | 'playing' | 'finished',
    createdAt: row.created_at as string,
    hostId: row.host_id as string | null,
  };
}

function mapJudgmentFromDb(row: Record<string, unknown>): Judgment {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    winnerTeam: row.winner_team as 'pro' | 'con' | 'draw',
    scores: row.scores as Record<string, number>,
    feedback: row.feedback as Record<string, string>,
    overallAnalysis: row.overall_analysis as string,
    createdAt: row.created_at as string,
  };
}

// Provider 컴포넌트
export function GameProvider({
  children,
  roomId,
}: {
  children: ReactNode;
  roomId: string;
}) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  // Supabase 연결 실패 시 에러 처리
  useEffect(() => {
    if (!supabase) {
      dispatch({ type: 'SET_ERROR', payload: 'Supabase 연결 설정이 필요합니다.' });
    }
  }, [supabase]);

  // 초기 데이터 로드
  const loadInitialData = useCallback(async () => {
    if (!supabase) return;
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      // 방 정보 로드
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError) throw roomError;
      dispatch({ type: 'SET_ROOM', payload: mapRoomFromDb(roomData) });

      // 플레이어 목록 로드
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId);

      if (playersError) throw playersError;
      dispatch({
        type: 'SET_PLAYERS',
        payload: (playersData || []).map(mapPlayerFromDb),
      });

      // 게임 상태 로드
      const { data: gameStateData } = await supabase
        .from('game_states')
        .select('*')
        .eq('room_id', roomId)
        .single();

      if (gameStateData) {
        dispatch({ type: 'SET_GAME_STATE', payload: mapGameStateFromDb(gameStateData) });
      }

      // 토론 카드 로드
      const { data: cardsData } = await supabase
        .from('debate_cards')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      dispatch({
        type: 'SET_CARDS',
        payload: (cardsData || []).map(mapCardFromDb),
      });

      // 판정 결과 로드
      const { data: judgmentData } = await supabase
        .from('judgments')
        .select('*')
        .eq('room_id', roomId)
        .single();

      if (judgmentData) {
        dispatch({ type: 'SET_JUDGMENT', payload: mapJudgmentFromDb(judgmentData) });
      }

      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
    }
  }, [roomId, supabase]);

  // 초기 데이터 로드
  useEffect(() => {
    if (!supabase) return;
    loadInitialData();
  }, [loadInitialData, supabase]);

  // Realtime 구독 (별도 useEffect로 분리하여 불필요한 재구독 방지)
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            dispatch({ type: 'SET_ROOM', payload: mapRoomFromDb(payload.new) });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            dispatch({ type: 'ADD_PLAYER', payload: mapPlayerFromDb(payload.new) });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            dispatch({ type: 'UPDATE_PLAYER', payload: mapPlayerFromDb(payload.new) });
          } else if (payload.eventType === 'DELETE' && payload.old) {
            dispatch({ type: 'REMOVE_PLAYER', payload: (payload.old as { id: string }).id });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_states',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) {
            dispatch({ type: 'SET_GAME_STATE', payload: mapGameStateFromDb(payload.new) });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'debate_cards',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) {
            dispatch({ type: 'ADD_CARD', payload: mapCardFromDb(payload.new) });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'judgments',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) {
            dispatch({ type: 'SET_JUDGMENT', payload: mapJudgmentFromDb(payload.new) });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

  // 방 참가
  const joinRoom = async (roomId: string, nickname: string) => {
    if (!supabase) throw new Error('Supabase 연결 설정이 필요합니다.');
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('players')
      .insert({
        room_id: roomId,
        user_id: user?.id || null,
        nickname,
        is_ai: false,
      })
      .select()
      .single();

    if (error) throw error;
    dispatch({ type: 'SET_CURRENT_PLAYER', payload: mapPlayerFromDb(data) });
  };

  // 방 나가기
  const leaveRoom = async () => {
    if (!supabase || !state.currentPlayer) return;

    await supabase.from('players').delete().eq('id', state.currentPlayer.id);
    dispatch({ type: 'SET_CURRENT_PLAYER', payload: null });
  };

  // 역할 선택
  const selectRole = async (role: 'pro' | 'con') => {
    if (!supabase || !state.currentPlayer || !state.gameState) return;

    const updateField = role === 'pro' ? 'pro_selection' : 'con_selection';

    await supabase
      .from('game_states')
      .update({ [updateField]: state.currentPlayer.id })
      .eq('room_id', roomId);
  };

  // 카드 제출
  const submitCard = async (content: string) => {
    if (!supabase || !state.currentPlayer || !state.gameState) return;

    await supabase.from('debate_cards').insert({
      room_id: roomId,
      player_id: state.currentPlayer.id,
      phase: state.gameState.phase,
      sub_phase: state.gameState.subPhase,
      content,
    });
  };

  // 페이즈 진행
  const advancePhase = async () => {
    if (!supabase || !state.gameState) return;

    const nextPhase = getNextPhase(state.gameState.phase);
    if (!nextPhase) return;

    const timerEndAt = calculateTimerEndAt(nextPhase);

    await supabase
      .from('game_states')
      .update({
        phase: nextPhase,
        timer_end_at: timerEndAt,
      })
      .eq('room_id', roomId);
  };

  // AI 응답 트리거
  const triggerAiResponse = async () => {
    if (!state.gameState) return;

    // AI API 호출
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        phase: state.gameState.phase,
        topic: state.gameState.topic,
        cards: state.cards,
        players: state.players,
      }),
    });

    if (!response.ok) {
      throw new Error('AI 응답 생성 실패');
    }
  };

  // 판정 요청
  const requestJudgment = async () => {
    const response = await fetch('/api/ai/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        topic: state.gameState?.topic,
        cards: state.cards,
        players: state.players,
      }),
    });

    if (!response.ok) {
      throw new Error('판정 요청 실패');
    }
  };

  const value: GameContextType = {
    state,
    joinRoom,
    leaveRoom,
    selectRole,
    submitCard,
    advancePhase,
    triggerAiResponse,
    requestJudgment,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// Hook
export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
