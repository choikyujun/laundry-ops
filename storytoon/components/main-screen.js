/**
 * StoryToon - 메인 화면 컴포넌트
 * 스토리 입력 / 스타일·컷 선택 / 생성 버튼
 */

import { AppState } from '../store/state.js';
import { showScreen } from '../main.js';
import { analyzeStory } from '../api/claude.js';
import { generateAllImages } from '../api/dalle.js';
import { setLoadingStep, resetLoadingSteps, showToast, formatDate, styleLabel } from '../utils/ui.js';

// ── 초기화 ───────────────────────────────────────
export function initMainScreen() {
  initTextarea();
  initStyleSelector();
  initCutsSelector();
  initGenerateButton();
  initMyTootsButton();

  // 만화 목록 변경 시 최근 목록 갱신
  AppState.on('toonsChanged', renderRecentList);
  renderRecentList(AppState.toons);
}

// ── 텍스트에어리어 ───────────────────────────────
function initTextarea() {
  const textarea = document.getElementById('story-input');
  const counter = document.getElementById('char-count');
  if (!textarea || !counter) return;

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    counter.textContent = `${len} / 500`;
    counter.classList.toggle('near-limit', len > 420);
    AppState.currentStory = textarea.value;
  });
}

// ── 스타일 선택 ──────────────────────────────────
function initStyleSelector() {
  const btns = document.querySelectorAll('#style-selector .style-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.currentStyle = btn.dataset.style;
    });
  });
}

// ── 컷 수 선택 ───────────────────────────────────
function initCutsSelector() {
  const btns = document.querySelectorAll('#cuts-selector .cut-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.currentCuts = parseInt(btn.dataset.cuts);
    });
  });
}

// ── 생성 버튼 ────────────────────────────────────
function initGenerateButton() {
  const btn = document.getElementById('btn-generate');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const story = document.getElementById('story-input')?.value?.trim();
    if (!story) {
      showToast('📝 이야기를 입력해주세요!');
      return;
    }
    if (story.length < 10) {
      showToast('이야기를 조금 더 자세히 입력해주세요 😊');
      return;
    }

    AppState.currentStory = story;
    await generateToon(story, AppState.currentStyle, AppState.currentCuts);
  });
}

// ── 내 만화 버튼 ─────────────────────────────────
function initMyTootsButton() {
  const btn = document.getElementById('btn-my-toots');
  if (!btn) return;
  btn.addEventListener('click', () => showScreen('library'));
}

// ── 만화 생성 메인 플로우 ────────────────────────
async function generateToon(story, style, cuts) {
  // 로딩 화면으로 전환
  showScreen('loading');
  resetLoadingSteps();

  try {
    // STEP 1: 스토리 분석
    setLoadingStep('step-story', 'active');
    const toonData = await analyzeStory({ story, cuts, style });
    setLoadingStep('step-story', 'done');

    // STEP 2: 장면 구성
    setLoadingStep('step-panels', 'active');
    await new Promise(r => setTimeout(r, 500)); // UI 피드백용 딜레이
    setLoadingStep('step-panels', 'done');

    // STEP 3: 이미지 생성
    setLoadingStep('step-images', 'active');
    const imageUrls = await generateAllImages({
      panels: toonData.panels,
      style,
      onProgress: (done, total) => {
        const el = document.querySelector('#step-images .step-text');
        if (el) el.textContent = `이미지 생성 중... (${done}/${total})`;
      },
    });
    setLoadingStep('step-images', 'done');

    // 이미지 URL 주입
    toonData.panels = toonData.panels.map((p, i) => ({
      ...p,
      imageUrl: imageUrls[i] || null,
    }));

    // 상태 저장
    AppState.currentToon = toonData;

    // 뷰어로 이동
    showScreen('viewer');
    window.dispatchEvent(new CustomEvent('toonReady', { detail: toonData }));

  } catch (err) {
    console.error('생성 실패:', err);
    showScreen('main');
    showToast(`생성 실패: ${err.message || '다시 시도해주세요.'}`);
  }
}

// ── 최근 만화 목록 렌더링 ────────────────────────
function renderRecentList(toons) {
  const list = document.getElementById('recent-list');
  const section = document.getElementById('recent-section');
  if (!list || !section) return;

  if (!toons || toons.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = toons.slice(0, 5).map(toon => `
    <div class="recent-item" data-id="${toon.id}">
      ${toon.panels?.[0]?.imageUrl
        ? `<img class="recent-thumb" src="${toon.panels[0].imageUrl}" alt="${toon.title}" loading="lazy">`
        : `<div class="recent-thumb">🌸</div>`
      }
      <div class="recent-info">
        <div class="recent-title">${escapeHtml(toon.title)}</div>
        <div class="recent-meta">${styleLabel(toon.style)} · ${toon.cuts}컷 · ${formatDate(toon.createdAt)}</div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.recent-item').forEach(item => {
    item.addEventListener('click', () => {
      const toon = toons.find(t => t.id === item.dataset.id);
      if (!toon) return;
      AppState.currentToon = toon;
      showScreen('viewer');
      window.dispatchEvent(new CustomEvent('toonReady', { detail: toon }));
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
