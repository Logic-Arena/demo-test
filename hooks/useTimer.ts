'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerOptions {
  onTimeout?: () => void;
  onTick?: (remaining: number) => void;
}

export function useTimer(endAt: string | null, options: UseTimerOptions = {}) {
  const [remaining, setRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const timeoutCalledRef = useRef(false);

  const { onTimeout, onTick } = options;

  const calculateRemaining = useCallback(() => {
    if (!endAt) return 0;
    const diff = new Date(endAt).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  }, [endAt]);

  useEffect(() => {
    if (!endAt) {
      setRemaining(0);
      setIsExpired(false);
      timeoutCalledRef.current = false;
      return;
    }

    // 초기값 설정
    const initialRemaining = calculateRemaining();
    setRemaining(initialRemaining);
    setIsExpired(initialRemaining <= 0);
    timeoutCalledRef.current = false;

    const interval = setInterval(() => {
      const newRemaining = calculateRemaining();
      setRemaining(newRemaining);

      if (onTick) {
        onTick(newRemaining);
      }

      if (newRemaining <= 0) {
        setIsExpired(true);
        clearInterval(interval);

        if (onTimeout && !timeoutCalledRef.current) {
          timeoutCalledRef.current = true;
          onTimeout();
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [endAt, calculateRemaining, onTimeout, onTick]);

  // 분:초 형식으로 포맷팅된 시간
  const formattedTime = useCallback(() => {
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [remaining]);

  // 진행률 (0-100)
  const getProgress = useCallback(
    (totalSeconds: number) => {
      if (totalSeconds <= 0) return 0;
      return Math.max(0, Math.min(100, (remaining / totalSeconds) * 100));
    },
    [remaining]
  );

  return {
    remaining,
    isExpired,
    formattedTime: formattedTime(),
    getProgress,
  };
}
