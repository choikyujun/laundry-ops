/**
 * StoryToon - Edge Function: image-generate
 * Pollinations.ai 사용 (무료, API 키 불필요)
 * 추후 DALL-E 3 / Stable Diffusion 유료 전환 가능
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const {
      prompt,
      negative_prompt = 'ugly, deformed, blurry, low quality, nsfw, watermark, text',
      width = 1024,
      height = 576,
    } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'prompt가 필요합니다.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // 프롬프트 정제 (URL 인코딩)
    const finalPrompt = prompt.slice(0, 1000);
    const seed = Math.floor(Math.random() * 999999);

    // Pollinations.ai API (무료, 인증 불필요)
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=true`;

    // URL 유효성 확인 (HEAD 요청)
    const check = await fetch(imageUrl, { method: 'HEAD' });
    if (!check.ok) {
      throw new Error(`이미지 생성 실패: ${check.status}`);
    }

    return new Response(
      JSON.stringify({ url: imageUrl }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Edge Function 오류:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
