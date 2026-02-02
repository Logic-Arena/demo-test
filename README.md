# Logic Arena - AI-인간 하이브리드 토론게임

사용자 2명과 AI 2명이 팀을 이루어(2:2) 특정 주제에 대해 토론하는 실시간 웹 게임입니다.

## 기술 스택

- **Frontend**: Next.js 16 (App Router), Tailwind CSS, Lucide React (Icons)
- **State Management**: React Context API
- **Real-time/Backend**: Supabase (Realtime, Auth, Database)
- **AI Integration**: OpenAI API (GPT-4o)

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 수정하여 실제 값으로 채워주세요:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key
```

### 3. Supabase 데이터베이스 설정

Supabase 대시보드에서 SQL Editor를 열고 `supabase/schema.sql` 파일의 내용을 실행하세요.

**Realtime 활성화:**
1. Supabase Dashboard > Database > Replication
2. 다음 테이블들에 대해 Realtime 활성화:
   - `rooms`
   - `players`
   - `game_states`
   - `debate_cards`
   - `judgments`

### 4. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 애플리케이션에 접속하세요.

## 게임 플로우

### 1. 로비
- 방 목록 확인 및 새 방 만들기
- 2명이 입장하면 게임 시작

### 2. 주제 선택 (10초)
- AI가 토론 주제 제안
- 찬성(Pro)/반대(Con) 선택
- 선택이 겹치면 재시도 (최대 3회)

### 3. 토론 진행
- **Phase 0**: 모든 참가자 주장 작성 (2분)
- **Cycle 1-4**: 반론 → 변론 → 재반론 순환
- **Phase 5**: 최종 정리 발언 (1분)

### 4. AI 판정
- 전체 토론 분석
- 참가자별 점수 및 피드백
- 승리 팀 선정

## 프로젝트 구조

```
├── app/
│   ├── page.tsx                # 로비 페이지
│   ├── room/[roomId]/page.tsx  # 게임 룸
│   └── api/ai/                 # AI API 라우트
├── components/
│   ├── lobby/                  # 로비 컴포넌트
│   └── game/                   # 게임 컴포넌트
├── contexts/
│   └── GameContext.tsx         # 게임 상태 관리
├── hooks/                      # 커스텀 훅
├── lib/                        # 유틸리티
└── types/                      # 타입 정의
```

## 라이선스

MIT
