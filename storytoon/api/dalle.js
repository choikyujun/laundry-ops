/**
 * StoryToon - DALL-E 3 이미지 생성 (Supabase Edge Function 경유)
 * API 키는 서버에서만 관리
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const IMAGE_URL = `${SUPABASE_URL}/functions/v1/image-generate`;

// ── 스타일별 공통 수식어 ─────────────────────────
const STYLE_SUFFIXES = {
  shoujo: 'high quality digital art, clean linework, no text, no watermark, masterpiece',
  webtoon: 'modern Korean digital comic art style, high quality, no text, no watermark',
  disney: 'professional animation quality, cinematic lighting, no text, no watermark, masterpiece',
};

// ── 네거티브 프롬프트 ────────────────────────────
const NEGATIVE_BASE = 'ugly, deformed, blurry, low quality, bad anatomy, extra limbs, bad hands, watermark, text, signature, nsfw';

// ── 단일 이미지 생성 ─────────────────────────────
export async function generatePanelImage({ panel, style = 'shoujo' }) {
  const prompt = buildPrompt(panel, style);

  const res = await fetch(IMAGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      prompt,
      negative_prompt: NEGATIVE_BASE,
      size: '1792x1024',
      quality: 'standard',
      style: 'vivid',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`이미지 생성 실패: ${res.status} ${err}`);
  }

  const data = await res.json();
  // Edge Function이 { url: "..." } 형태로 반환
  return data.url || data.imageUrl || null;
}

// ── 전체 패널 이미지 일괄 생성 ───────────────────
// 병렬 처리 (DALL-E rate limit 고려해 2개씩 배치)
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
      if (result.status === 'fulfilled') {
        urls[idx] = result.value;
      } else {
        console.warn(`패널 ${idx + 1} 이미지 생성 실패:`, result.reason);
        urls[idx] = null; // 실패 시 플레이스홀더 사용
      }
    });

    onProgress?.(Math.min(i + BATCH_SIZE, panels.length), panels.length);

    // 배치 간 딜레이 (rate limit 방지)
    if (i + BATCH_SIZE < panels.length) {
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  return urls;
}

// ── 프롬프트 빌더 ────────────────────────────────
function buildPrompt(panel, style) {
  const basePrompt = panel.imagePrompt?.[style] || panel.description || panel.scene;
  const suffix = STYLE_SUFFIXES[style] || STYLE_SUFFIXES.shoujo;
  return `${basePrompt}, ${suffix}`;
}
