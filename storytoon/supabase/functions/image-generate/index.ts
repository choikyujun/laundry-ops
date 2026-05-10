/**
 * StoryToon - Edge Function: image-generate
 * OpenAI DALL-E 3 이미지 생성 (서버에서 API 키 관리)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const OPENAI_API_URL = 'https://api.openai.com/v1/images/generations';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const {
      prompt,
      negative_prompt,
      size = '1792x1024',
      quality = 'standard',
      style = 'vivid',
    } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'prompt가 필요합니다.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API 키가 설정되지 않았습니다.' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // 프롬프트 길이 제한 (DALL-E 3: 4000자)
    const finalPrompt = prompt.slice(0, 3800);

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: finalPrompt,
        n: 1,
        size,
        quality,
        style,
        response_format: 'url',
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('DALL-E API 오류:', err);

      // Rate limit 처리
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }),
          { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: `DALL-E API 오류: ${response.status}`, detail: err }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;

    if (!imageUrl) {
      throw new Error('이미지 URL을 받지 못했습니다.');
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
