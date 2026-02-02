import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const missing = [
      !supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
      !supabaseKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ].filter(Boolean).join(', ');
    throw new Error(
      `Supabase 환경 변수가 설정되지 않았습니다: ${missing}. Vercel 환경 변수 설정 후 재배포가 필요합니다.`
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
