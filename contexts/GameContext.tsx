'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
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
import { calculateTimerEndAt, getNextPhase, getRandomTopic, getRequiredSubmitterIds, getAiPlayersForPhase } from '@/lib/gameLogic';

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
      return {
        ...state,
        players: action.payload,
        currentPlayer: state.currentPlayer
          ? action.payload.find(p => p.id === state.currentPlayer!.id) || state.currentPlayer
          : state.currentPlayer,
      };
    case 'ADD_PLAYER':
      return { ...state, players: [...state.players, action.payload] };
    case 'UPDATE_PLAYER': {
      const updated = action.payload;
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === updated.id ? updated : p
        ),
        currentPlayer: state.currentPlayer?.id === updated.id
          ? updated
          : state.currentPlayer,
      };
    }
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
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
      if (roomError) throw roomError;
      dispatch({ type: 'SET_ROOM', payload: mapRoomFromDb(roomData) });

      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId);
      if (playersError) throw playersError;
      const players = (playersData || []).map(mapPlayerFromDb);
      dispatch({ type: 'SET_PLAYERS', payload: players });

      // localStorage에 저장된 플레이어 ID로 currentPlayer 설정
      const storedPlayerId = localStorage.getItem(`room_${roomId}_playerId`);
      if (storedPlayerId) {
        const currentPlayer = players.find(p => p.id === storedPlayerId);
        if (currentPlayer) {
          dispatch({ type: 'SET_CURRENT_PLAYER', payload: currentPlayer });
        }
      }

      const { data: gameStateData } = await supabase
        .from('game_states')
        .select('*')
        .eq('room_id', roomId)
        .single();
      if (gameStateData) {
        dispatch({ type: 'SET_GAME_STATE', payload: mapGameStateFromDb(gameStateData) });
      }

      const { data: cardsData } = await supabase
        .from('debate_cards')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      dispatch({
        type: 'SET_CARDS',
        payload: (cardsData || []).map(mapCardFromDb),
      });

      const { data: judgmentData } = await supabase
        .from('judgments')
        .select('*')
        .eq('room_id', roomId)
        .single();
      if (judgmentData) {
        dispatch({ type: 'SET_JUDGMENT', payload: mapJudgmentFromDb(judgmentData) });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [roomId, supabase]);

  // 초기 데이터 로드
  useEffect(() => {
    if (!supabase) return;
    loadInitialData();
  }, [loadInitialData, supabase]);

  // Realtime 구독 (즉시 반영, Supabase Replication 설정 필요)
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
        async (payload) => {
          if (payload.new) {
            dispatch({ type: 'SET_GAME_STATE', payload: mapGameStateFromDb(payload.new) });
            const { data } = await supabase
              .from('debate_cards')
              .select('*')
              .eq('room_id', roomId)
              .order('created_at', { ascending: true });
            if (data) {
              dispatch({ type: 'SET_CARDS', payload: data.map(mapCardFromDb) });
            }
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

  // 폴링으로 game_states, players, cards 재조회 (Realtime 미작동 환경 대비)
  useEffect(() => {
    if (!supabase) return;

    const interval = setInterval(async () => {
      // game_states 재조회
      const { data: gsData } = await supabase
        .from('game_states')
        .select('*')
        .eq('room_id', roomId)
        .single();
      if (gsData) {
        dispatch({ type: 'SET_GAME_STATE', payload: mapGameStateFromDb(gsData) });
      }

      // players 재조회
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId);
      if (playersData) {
        dispatch({ type: 'SET_PLAYERS', payload: playersData.map(mapPlayerFromDb) });
      }

      // cards 재조회
      const { data: cardsData } = await supabase
        .from('debate_cards')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      if (cardsData) {
        dispatch({ type: 'SET_CARDS', payload: cardsData.map(mapCardFromDb) });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [roomId, supabase]);

  // 모든 필수 제출이 완료되면 다음 단계로 진행 (인간 + AI 공통)
  const advancingPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    if (!supabase || !state.gameState) return;
    const phase = state.gameState.phase;
    const requiredIds = getRequiredSubmitterIds(phase, state.players);
    if (requiredIds.length === 0) return;
    const cardsInPhase = state.cards.filter(c => c.phase === phase);
    const submittedIds = [...new Set(cardsInPhase.map(c => c.playerId))];
    const allSubmitted = requiredIds.every(id => submittedIds.includes(id));
    if (!allSubmitted) return;

    // 같은 phase에 대해 중복 advance 방지
    if (advancingPhaseRef.current === phase) return;
    advancingPhaseRef.current = phase;

    const nextPhase = getNextPhase(phase);
    if (!nextPhase) return;
    const timerEndAt = calculateTimerEndAt(nextPhase);
    supabase
      .from('game_states')
      .update({ phase: nextPhase, timer_end_at: timerEndAt })
      .eq('room_id', roomId)
      .then(() => {});
  }, [state.cards, state.gameState?.phase, state.players, roomId, supabase]);

  // AI 트리거 — phase 변경 시 해당 phase에서 AI가 카드를 제출해야 하면 호출
  // 리더 클라이언트(인간 플레이어 ID 정렬 시 첫 번째)만 트리거하여 이중 호출 방지
  const triggeredPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    if (!state.gameState || state.players.length === 0) return;
    const phase = state.gameState.phase;
    if (triggeredPhaseRef.current === phase) return;

    // 리더 클라이언트만 AI를 트리거
    const humanPlayers = state.players.filter(p => !p.isAi).sort((a, b) => a.id.localeCompare(b.id));
    const isLeader = state.currentPlayer && humanPlayers.length > 0 && humanPlayers[0].id === state.currentPlayer.id;
    if (!isLeader) return;

    const aiPlayers = getAiPlayersForPhase(phase, state.players);
    if (aiPlayers.length === 0) return;

    triggeredPhaseRef.current = phase;

    aiPlayers.forEach(aiPlayer => {
      fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          phase,
          topic: state.gameState!.topic,
          cards: state.cards,
          players: state.players,
          targetPlayerId: aiPlayer.id,
        }),
      }).catch(err => console.error('[AI trigger] 실패:', aiPlayer.id, err));
    });
  }, [state.gameState?.phase, state.players, state.currentPlayer, roomId]);

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

  // 카드 목록 다시 불러오기 (제출 후·phase 변경 시 동기화용). 반환값으로 목록 전달.
  const refetchCards = useCallback(async (): Promise<DebateCard[]> => {
    if (!supabase) return [];
    const { data } = await supabase
      .from('debate_cards')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    const list = (data || []).map(mapCardFromDb);
    dispatch({ type: 'SET_CARDS', payload: list });
    return list;
  }, [roomId, supabase]);

  // 카드 제출 (제출 즉시 화면에 반영 + 필요 시 다음 단계로 진행)
  const submitCard = async (content: string) => {
    console.log('[submitCard] currentPlayer:', state.currentPlayer?.id, 'phase:', state.gameState?.phase);
    if (!supabase || !state.currentPlayer || !state.gameState) {
      console.warn('[submitCard] 조건 미충족 - supabase:', !!supabase, 'currentPlayer:', !!state.currentPlayer, 'gameState:', !!state.gameState);
      return;
    }

    const { data, error } = await supabase
      .from('debate_cards')
      .insert({
        room_id: roomId,
        player_id: state.currentPlayer.id,
        phase: state.gameState.phase,
        sub_phase: state.gameState.subPhase,
        content,
      })
      .select()
      .single();

    if (error) throw error;
    const newCard = data ? mapCardFromDb(data) : null;
    if (newCard) {
      dispatch({ type: 'ADD_CARD', payload: newCard });
    }

    const phase = state.gameState.phase;
    const requiredIds = getRequiredSubmitterIds(phase, state.players);

    // 제출 직후 카드 목록 재조회 (다른 클라이언트와 동기화) 후 전원 제출 여부 판단
    const afterCards = await refetchCards();
    const cardsInPhase = afterCards.filter(c => c.phase === phase);
    const submittedIds = [...new Set(cardsInPhase.map(c => c.playerId))];
    const allSubmitted = requiredIds.length > 0 && requiredIds.every(id => submittedIds.includes(id));
    console.log('[submitCard] requiredIds:', requiredIds, 'submittedIds:', submittedIds, 'allSubmitted:', allSubmitted);

    if (allSubmitted) {
      // advancingPhaseRef로 useEffect와의 이중 advance 방지
      if (advancingPhaseRef.current === phase) return;
      advancingPhaseRef.current = phase;

      const nextPhase = getNextPhase(phase);
      if (nextPhase) {
        const timerEndAt = calculateTimerEndAt(nextPhase);
        await supabase
          .from('game_states')
          .update({ phase: nextPhase, timer_end_at: timerEndAt })
          .eq('room_id', roomId);
      }
    }
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
