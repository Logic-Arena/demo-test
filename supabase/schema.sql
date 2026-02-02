-- Logic Arena 데이터베이스 스키마
-- Supabase SQL Editor에서 실행하세요

-- 1. rooms 테이블: 게임 방 정보
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  created_at timestamp with time zone default now(),
  host_id uuid references auth.users(id) on delete set null
);

-- 2. players 테이블: 플레이어 정보
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  nickname text not null,
  role text check (role in ('pro', 'con') or role is null),
  is_ai boolean default false,
  team text check (team in ('A', 'B') or team is null),
  joined_at timestamp with time zone default now()
);

-- 3. game_states 테이블: 게임 상태
create table if not exists public.game_states (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade not null unique,
  phase text not null default 'waiting',
  sub_phase text,
  current_turn uuid references public.players(id) on delete set null,
  topic text,
  topic_attempts int default 0,
  timer_end_at timestamp with time zone,
  pro_selection uuid references public.players(id) on delete set null,
  con_selection uuid references public.players(id) on delete set null,
  updated_at timestamp with time zone default now()
);

-- 4. debate_cards 테이블: 토론 카드
create table if not exists public.debate_cards (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  player_id uuid references public.players(id) on delete cascade not null,
  phase text not null,
  sub_phase text,
  content text not null,
  created_at timestamp with time zone default now()
);

-- 5. judgments 테이블: 판정 결과
create table if not exists public.judgments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  winner_team text check (winner_team in ('pro', 'con', 'draw')) not null,
  scores jsonb not null default '{}',
  feedback jsonb not null default '{}',
  overall_analysis text not null,
  created_at timestamp with time zone default now()
);

-- 인덱스 생성
create index if not exists idx_players_room_id on public.players(room_id);
create index if not exists idx_debate_cards_room_id on public.debate_cards(room_id);
create index if not exists idx_game_states_room_id on public.game_states(room_id);
create index if not exists idx_rooms_status on public.rooms(status);

-- RLS (Row Level Security) 활성화
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.game_states enable row level security;
alter table public.debate_cards enable row level security;
alter table public.judgments enable row level security;

-- RLS 정책: 모든 사용자가 방을 볼 수 있음
create policy "Anyone can view rooms" on public.rooms
  for select using (true);

-- RLS 정책: 인증된 사용자만 방을 생성할 수 있음
create policy "Authenticated users can create rooms" on public.rooms
  for insert with check (auth.role() = 'authenticated');

-- RLS 정책: 호스트만 방을 수정할 수 있음
create policy "Host can update room" on public.rooms
  for update using (auth.uid() = host_id);

-- RLS 정책: 모든 사용자가 플레이어를 볼 수 있음
create policy "Anyone can view players" on public.players
  for select using (true);

-- RLS 정책: 인증된 사용자가 플레이어로 참가할 수 있음
create policy "Authenticated users can join as player" on public.players
  for insert with check (auth.role() = 'authenticated' or is_ai = true);

-- RLS 정책: 자신의 플레이어 정보를 수정할 수 있음
create policy "Users can update own player" on public.players
  for update using (auth.uid() = user_id or is_ai = true);

-- RLS 정책: 모든 사용자가 게임 상태를 볼 수 있음
create policy "Anyone can view game states" on public.game_states
  for select using (true);

-- RLS 정책: 인증된 사용자가 게임 상태를 생성/수정할 수 있음
create policy "Authenticated users can manage game states" on public.game_states
  for all using (auth.role() = 'authenticated');

-- RLS 정책: 모든 사용자가 토론 카드를 볼 수 있음
create policy "Anyone can view debate cards" on public.debate_cards
  for select using (true);

-- RLS 정책: 인증된 사용자가 토론 카드를 생성할 수 있음
create policy "Authenticated users can create debate cards" on public.debate_cards
  for insert with check (auth.role() = 'authenticated');

-- RLS 정책: 모든 사용자가 판정 결과를 볼 수 있음
create policy "Anyone can view judgments" on public.judgments
  for select using (true);

-- RLS 정책: 인증된 사용자가 판정 결과를 생성할 수 있음 (서버에서만 사용)
create policy "Authenticated users can create judgments" on public.judgments
  for insert with check (auth.role() = 'authenticated');

-- updated_at 자동 업데이트 함수
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- game_states updated_at 트리거
create trigger set_game_states_updated_at
  before update on public.game_states
  for each row
  execute function public.handle_updated_at();

-- Realtime 활성화 (Supabase Dashboard에서도 가능)
-- 아래 쿼리는 Supabase Dashboard > Database > Replication에서 설정할 수 있습니다
-- alter publication supabase_realtime add table public.rooms;
-- alter publication supabase_realtime add table public.players;
-- alter publication supabase_realtime add table public.game_states;
-- alter publication supabase_realtime add table public.debate_cards;
-- alter publication supabase_realtime add table public.judgments;
