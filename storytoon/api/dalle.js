/**
 * StoryToon - 이미지 생성 API
 * 현재: Pollinations.ai (무료, API 키 불필요)
 * 전환: DALL-E 3 사용 시 USE_DALLE = true + Edge Function 활성화
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

// ── 모드 전환 플래그 (유료 전환 시 true로) ────────
const USE_DALLE = false;
const IMAGE_EDGE_URL = `${SUPABASE_URL}/functions/v1/image-generate`;

// ── 스타일별 프롬프트 수식어 ─────────────────────
const STYLE_SUFFIXES = {
  shoujo: 'shoujo anime manga style, soft pastel colors, sparkle effects, Studio Ghibli inspired, high quality, no text, no watermark',
  webtoon: 'Korean webtoon style, clean bold linework, vibrant colors, modern Korean digital comic, high quality, no text, no watermark',
  disney: 'Disney Pixar 3D animation style, cinematic lighting, vibrant rich colors, professional quality, no text, no watermark',
};

// ── 단일 이미지 생성 ─────────────────────────────
export async function generatePanelImage({ panel, style = 'shoujo' }) {
  const prompt = buildPrompt(panel, style);
  return USE_DALLE ? generateViaDalle(prompt) : generateViaPollinations(prompt);
}

// ── 전체 패널 이미지 일괄 생성 ───────────────────
export async function generateAllImages({ panels, style = 'shoujo', onProgress }) {
  const BATCH_SIZE = 2;
  const urls = new Array(panels.length).fill(null);

  for (let i = 0; i < panels.length; i += BATCH_SIZE) {
    const batch = panels.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(panel => generatePanelImage({ panel, style }))
    );

    results.forEach((result, j) => {
      const idx = i + j;
      urls[idx] = result.status === 'fulfilled' ? result.value : null;
      if (result.status === 'rejected') {
        console.warn(`패널 ${idx + 1} 이미지 생성 실패:`, result.reason);
      }
    });

    onProgress?.(Math.min(i + BATCH_SIZE, panels.length), panels.length);

    // 배치 간 딜레이
    if (i + BATCH_SIZE < panels.length) {
      await new Promise(r => setTimeout(r, 800));
    }
  }

  return urls;
}

// ── Pollinations.ai (무료) ───────────────────────
async function generateViaPollinations(prompt) {
  const seed = Math.floor(Math.random() * 999999);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 1000))}?width=1024&height=576&seed=${seed}&nologo=true&enhance=true`;

  // pollinations는 URL 자체가 이미지 — 실제 fetch 없이 URL만 반환
  // (브라우저에서 <img src="..."> 로 바로 로드됨)
  return url;
}

// ── DALL-E 3 (유료, 추후 전환) ───────────────────
async function generateViaDalle(prompt) {
  const res = await fetch(IMAGE_EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      prompt,
      size: '1792x1024',
      quality: 'standard',
      style: 'vivid',
    }),
  });

  if (!res.ok) throw new Error(`이미지 생성 실패: ${res.status}`);
  const data = await res.json();
  return data.url || null;
}

// ── 프롬프트 빌더 ────────────────────────────────
function buildPrompt(panel, style) {
  const base = panel.imagePrompt?.[style] || panel.description || panel.scene || '';
  const suffix = STYLE_SUFFIXES[style] || STYLE_SUFFIXES.shoujo;
  return `${base}, ${suffix}`;
}
