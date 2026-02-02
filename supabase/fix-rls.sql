-- 기존 RLS 정책 삭제
drop policy if exists "Anyone can view rooms" on public.rooms;
drop policy if exists "Authenticated users can create rooms" on public.rooms;
drop policy if exists "Host can update room" on public.rooms;
drop policy if exists "Anyone can view players" on public.players;
drop policy if exists "Authenticated users can join as player" on public.players;
drop policy if exists "Users can update own player" on public.players;
drop policy if exists "Anyone can view game states" on public.game_states;
drop policy if exists "Authenticated users can manage game states" on public.game_states;
drop policy if exists "Anyone can view debate cards" on public.debate_cards;
drop policy if exists "Authenticated users can create debate cards" on public.debate_cards;
drop policy if exists "Anyone can view judgments" on public.judgments;
drop policy if exists "Authenticated users can create judgments" on public.judgments;

-- 새로운 RLS 정책 (익명 사용자 허용)
-- rooms: 모든 작업 허용
create policy "Allow all on rooms" on public.rooms for all using (true) with check (true);

-- players: 모든 작업 허용
create policy "Allow all on players" on public.players for all using (true) with check (true);

-- game_states: 모든 작업 허용
create policy "Allow all on game_states" on public.game_states for all using (true) with check (true);

-- debate_cards: 모든 작업 허용
create policy "Allow all on debate_cards" on public.debate_cards for all using (true) with check (true);

-- judgments: 모든 작업 허용
create policy "Allow all on judgments" on public.judgments for all using (true) with check (true);
