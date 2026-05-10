/**
 * StoryToon - 이미지 생성 API
 * 현재: Pollinations.ai (무료, API 키 불필요)
 * 전환: DALL-E 3 사용 시 USE_DALLE = true + Edge Function 활성화
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

// ── 모드 전환 플래그 (유료 전환 시 true로) ────────
const USE_DALLE = false;
const IMAGE_EDGE_URL = `${SUPABASE_URL}/functions/v1/image-generate`;

// ── 스타일별 핵심 수식어 (짧게 유지 - Pollinations 안정성) ──
const STYLE_PREFIX = {
  shoujo:  'shoujo anime style, soft pastel colors, clean linework, no text',
  webtoon: 'Korean webtoon style, bold lines, vibrant colors, no text',
  disney:  'Disney Pixar 3D style, cinematic lighting, colorful, no text',
};

// ── 단일 이미지 생성 (재시도 포함) ──────────────
export async function generatePanelImage({ panel, style = 'shoujo' }) {
  const prompt = buildPrompt(panel, style);
  if (USE_DALLE) return generateViaDalle(prompt);
  return generateViaPollinations(prompt, 0);
}

// ── 전체 패널 이미지 순차 생성 ──────────────────
// Pollinations rate limit 방지 → 1개씩 순차 처리
export async function generateAllImages({ panels, style = 'shoujo', onProgress }) {
  const urls = [];

  for (let i = 0; i < panels.length; i++) {
    try {
      const url = await generatePanelImage({ panel: panels[i], style });
      urls.push(url);
    } catch (err) {
      console.warn(`패널 ${i + 1} 실패:`, err.message);
      urls.push(null);
    }

    onProgress?.(i + 1, panels.length);

    // 패널 간 딜레이 (rate limit 방지)
    if (i < panels.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return urls;
}

// ── Pollinations.ai (무료) - 재시도 3회 ─────────
async function generateViaPollinations(prompt, attempt = 0) {
  const MAX_RETRY = 3;
  const seed = Math.floor(Math.random() * 999999);

  // 프롬프트 400자로 제한 (안정성)
  const safePrompt = prompt.slice(0, 400);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt)}?width=896&height=512&seed=${seed}&nologo=true&enhance=false`;

  try {
    // 실제 이미지 로드 확인 (타임아웃 20초)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return url;

  } catch (err) {
    if (attempt < MAX_RETRY) {
      console.warn(`재시도 ${attempt + 1}/${MAX_RETRY}:`, err.message);
      await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
      return generateViaPollinations(prompt, attempt + 1);
    }
    throw new Error(`이미지 생성 실패 (${attempt + 1}회 시도): ${err.message}`);
  }
}

// ── DALL-E 3 (유료, 추후 전환) ───────────────────
async function generateViaDalle(prompt) {
  const res = await fetch(IMAGE_EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ prompt, size: '1792x1024', quality: 'standard', style: 'vivid' }),
  });
  if (!res.ok) throw new Error(`이미지 생성 실패: ${res.status}`);
  const data = await res.json();
  return data.url || null;
}

// ── 프롬프트 빌더 (간결하게) ─────────────────────
function buildPrompt(panel, style) {
  // imagePrompt가 있으면 우선 사용, 없으면 scene+description으로 대체
  const base = panel.imagePrompt?.[style]
    || `${panel.scene || ''}, ${panel.description || ''}`.slice(0, 200);
  const prefix = STYLE_PREFIX[style] || STYLE_PREFIX.shoujo;
  return `${base}, ${prefix}`;
}
