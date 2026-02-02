'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface InputAreaProps {
  onSubmit: (content: string) => Promise<void>;
  isDisabled: boolean;
  placeholder?: string;
  maxLength?: number;
}

export function InputArea({ 
  onSubmit, 
  isDisabled, 
  placeholder = '발언을 입력하세요...',
  maxLength = 1000 
}: InputAreaProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // 활성화되면 포커스
    if (!isDisabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isDisabled]);

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting || isDisabled) return;

    setIsSubmitting(true);
    try {
      await onSubmit(content.trim());
      setContent('');
    } catch (error) {
      console.error('제출 실패:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const charCount = content.length;
  const isOverLimit = charCount > maxLength;

  return (
    <div className={`bg-white rounded-xl border-2 transition-colors ${
      isDisabled 
        ? 'border-gray-200 bg-gray-50' 
        : 'border-blue-200 focus-within:border-blue-400'
    }`}>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isDisabled ? '현재 발언할 수 없습니다' : placeholder}
        disabled={isDisabled || isSubmitting}
        className="w-full p-4 bg-transparent resize-none focus:outline-none disabled:cursor-not-allowed min-h-[120px]"
        rows={4}
      />
      
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className={isOverLimit ? 'text-red-500' : ''}>
            {charCount}/{maxLength}
          </span>
          <span className="hidden sm:inline">
            Ctrl/Cmd + Enter로 제출
          </span>
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={isDisabled || isSubmitting || !content.trim() || isOverLimit}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>제출 중...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>제출</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
