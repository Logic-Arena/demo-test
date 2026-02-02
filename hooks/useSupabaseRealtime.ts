'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface SubscriptionConfig {
  table: string;
  filter?: string;
  event?: PostgresChangeEvent;
  callback: (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void;
}

export function useSupabaseRealtime(
  channelName: string,
  subscriptions: SubscriptionConfig[]
) {
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // 이미 존재하는 채널이 있으면 제거
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // 새 채널 생성
    let channel = supabase.channel(channelName);

    // 각 구독 설정 추가
    subscriptions.forEach((sub) => {
      channel = channel.on(
        'postgres_changes',
        {
          event: sub.event || '*',
          schema: 'public',
          table: sub.table,
          filter: sub.filter,
        },
        (payload) => {
          sub.callback({
            eventType: payload.eventType,
            new: payload.new as Record<string, unknown>,
            old: payload.old as Record<string, unknown>,
          });
        }
      );
    });

    // 구독 시작
    channel.subscribe();
    channelRef.current = channel;

    // 클린업
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [channelName, supabase]); // subscriptions는 의존성에서 제외 (매번 새 배열이 생성될 수 있음)

  return channelRef.current;
}
