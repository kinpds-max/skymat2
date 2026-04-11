/* ==============================================
   하늘매트 — Supabase 설정
   supabase.com → 프로젝트 → Settings → API
   에서 아래 두 값을 복사해서 붙여넣으세요.
   ============================================== */

const SUPABASE_URL  = 'YOUR_SUPABASE_URL';   // 예: https://xxxx.supabase.co
const SUPABASE_KEY  = 'YOUR_SUPABASE_ANON_KEY'; // anon/public 키

/* Supabase 클라이언트 생성 (CDN 로드 후 사용 가능) */
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
