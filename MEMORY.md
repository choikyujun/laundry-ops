# Long-Term Memory & Rules

## 🏗️ Architecture Rules
- **[CRITICAL] v35 and Beyond (SQL-First):** All data access MUST use direct database queries (Supabase SQL-first) against individual tables (`factories`, `hotels`, `invoices`, `staff`, etc.). 
- **NO LOCAL JSON:** Absolutely NO use of the legacy `platform_data` JSON blob or local `platformData` state. Do not use or write functions like `syncToSupabase` that dump entire state trees.
- This rule applies unconditionally to all future features, lists, charts, and data bindings.
- **⚠️ 2026-04-16 사장님 직접 강조:** `app_v38.js` 내부에 레거시 코드(`platformData`, `f.hotels[hId]`, `saveData()`, `fetchFromSupabase()` 등)가 잔존하고 있음. 버그 수정 시 해당 패턴 발견하면 반드시 DB 쿼리 방식으로 교체할 것. 절대 레거시 코드 재사용 금지.
- **금지 패턴:** `platformData.factories[...]`, `f.hotels[hId]`, `f.history`, `f.staffAccounts`, `saveData()`, `fetchFromSupabase()`, `syncToSupabase()`
- **올바른 패턴:** `window.mySupabase.from('테이블명').select/insert/update/delete`

## 🌐 배포 정보
- **서비스 URL:** https://www.laundryops.co.kr
- **Vercel URL:** https://laundry-ops.vercel.app (내부)
- **GitHub 저장소:** https://github.com/choikyujin/laundry-ops
- **배포 방식:** GitHub main 브랜치 push → Vercel 자동 배포 (1~2분 소요)
- **배포 파일 위치:** `/Users/seobang/.openclaw/workspace/laundryops/dist/`

## 📁 작업 폴더 구조 (2026-04-28 정리)
- **laundryops 작업 경로:** `/Users/seobang/.openclaw/workspace/laundryops/`
  - 핵심 파일: `app_v38.js`, `index.html`, `style.css`, `거래명세서프로그램v38.html`
  - 백업: `backup/` (v27~v38), `archive/`, `old/`
  - 배포: `dist/`
  - Supabase: `supabase/`, `supabase-functions/`
- **홈페이지 작업 경로:** `/Users/seobang/.openclaw/workspace/cegohome/`
- **v38 이후 모든 작업은 laundryops/ 기준으로 진행**

## 📝 User Preferences
- 사장님(Sajangnim) prefers clear, direct fixes and emphasizes stability.
- Use explicit versioning in file names (e.g., `v32`, `v35.html`, `app_v35.js`).
- Prefers 'v34' as a safe baseline when 'v35' gets hopelessly tangled.
- **버전 유지 (2026-04-21):** v38 버전 번호를 그대로 유지하면서 로컬에서 계속 작업 진행할 것.