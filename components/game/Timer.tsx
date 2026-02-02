'use client';

import { Clock, AlertTriangle } from 'lucide-react';

interface TimerProps {
  remaining: number;
  formattedTime: string;
  totalSeconds: number;
  showProgress?: boolean;
}

export function Timer({ remaining, formattedTime, totalSeconds, showProgress = true }: TimerProps) {
  const progress = totalSeconds > 0 ? (remaining / totalSeconds) * 100 : 0;
  const isLow = remaining <= 10;
  const isCritical = remaining <= 5;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Timer Display */}
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-lg font-bold transition-colors ${
          isCritical
            ? 'bg-red-100 text-red-600'
            : isLow
            ? 'bg-yellow-100 text-yellow-600'
            : 'bg-gray-100 text-gray-700'
        }`}
      >
        {isCritical ? (
          <AlertTriangle className="w-5 h-5 animate-pulse" />
        ) : (
          <Clock className="w-5 h-5" />
        )}
        <span className={isCritical ? 'animate-pulse' : ''}>{formattedTime}</span>
      </div>

      {/* Progress Bar */}
      {showProgress && (
        <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ${
              isCritical
                ? 'bg-red-500'
                : isLow
                ? 'bg-yellow-500'
                : 'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
