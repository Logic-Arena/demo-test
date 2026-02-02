-- Supabase Realtime을 사용하려면 아래 테이블들을
-- supabase_realtime publication에 추가해야 합니다.
--
-- Supabase Dashboard > Database > Replication 에서
-- 테이블별로 "Realtime"을 켜거나, SQL Editor에서 아래를 실행하세요.

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.game_states;
alter publication supabase_realtime add table public.debate_cards;
alter publication supabase_realtime add table public.judgments;
