/* ===== CEGO 메인 JS ===== */

document.addEventListener('DOMContentLoaded', () => {

  // ── 1. 햄버거 메뉴 ──────────────────────────────
  const hamburger = document.querySelector('.hamburger');
  const navMobile = document.querySelector('.nav-mobile');

  if (hamburger && navMobile) {
    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.classList.toggle('open');
      navMobile.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // 모바일 메뉴 링크 클릭 시 닫기
    navMobile.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navMobile.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    // 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
      if (!hamburger.contains(e.target) && !navMobile.contains(e.target)) {
        hamburger.classList.remove('open');
        navMobile.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  // ── 2. 스크롤 시 헤더 그림자 ────────────────────
  const header = document.querySelector('.header');
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 30) {
        header.style.boxShadow = '0 4px 24px rgba(0,0,0,0.12)';
      } else {
        header.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ── 3. IntersectionObserver 스크롤 애니메이션 ───
  const animElems = document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right');

  if (animElems.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // 한 번만 실행
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    animElems.forEach(el => observer.observe(el));
  }

  // ── 4. 현재 페이지 nav 활성화 ───────────────────
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-desktop a, .nav-mobile a').forEach(link => {
    const href = link.getAttribute('href');
    if (href && (href === currentPage || (currentPage === '' && href === 'index.html'))) {
      link.classList.add('active');
    }
  });

  // ── 5. 숫자 카운트업 애니메이션 (stats) ─────────
  const statNumbers = document.querySelectorAll('.stat-number[data-target]');
  if (statNumbers.length > 0) {
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.target);
          const duration = 1800;
          const suffix = el.dataset.suffix || '';
          let start = 0;
          const step = (timestamp) => {
            if (!start) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            // easeOutQuart
            const eased = 1 - Math.pow(1 - progress, 4);
            el.textContent = Math.floor(eased * target).toLocaleString() + suffix;
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          countObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    statNumbers.forEach(el => countObserver.observe(el));
  }

  // ── 6. 견적 폼 제출 ──────────────────────────────
  const quoteForm = document.getElementById('quoteForm');
  if (quoteForm) {
    quoteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = quoteForm.querySelector('[name="name"]').value.trim();
      const phone = quoteForm.querySelector('[name="phone"]').value.trim();
      const message = quoteForm.querySelector('[name="message"]').value.trim();
      if (!name || !phone) {
        alert('이름과 연락처는 필수 입력 항목입니다.');
        return;
      }
      if (!message) {
        alert('문의 내용을 입력해 주세요.');
        return;
      }

      const submitBtn = quoteForm.querySelector('.form-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ 전송 중...';

      const inquiryType = quoteForm.querySelector('[name="inquiry_type"]')?.value || '';
      const industry = quoteForm.querySelector('[name="industry"]')?.value || '';
      const scale = quoteForm.querySelector('[name="scale"]')?.value.trim() || '';

      // SMS 발송 함수
      const sendSMS = async () => {
        const smsText = `[CEGO 견적요청]\n이름: ${name}\n연락처: ${phone}\n유형: ${inquiryType}\n업종: ${industry}${scale ? '\n규모: ' + scale : ''}\n내용: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`;
        try {
          await fetch('https://tphagookafjldzvxaxui.supabase.co/functions/v1/send-sms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq'
            },
            body: JSON.stringify({ receiver: '01051041648', message: smsText })
          });
        } catch (e) {
          console.warn('SMS 발송 실패:', e);
        }
      };

      // Formspree 이메일 전송
      const action = quoteForm.getAttribute('action');
      if (action && !action.includes('YOUR_FORM_ID')) {
        try {
          const formData = new FormData(quoteForm);
          const [res] = await Promise.all([
            fetch(action, {
              method: 'POST',
              body: formData,
              headers: { 'Accept': 'application/json' }
            }),
            sendSMS()
          ]);
          if (res.ok) {
            submitBtn.textContent = '✅ 전송 완료!';
            alert(`✅ 견적 문의가 접수되었습니다!\n\n이름: ${name}\n연락처: ${phone}\n\n빠른 시일 내에 연락드리겠습니다.\n감사합니다! 🙏`);
            quoteForm.reset();
          } else {
            throw new Error('전송 실패');
          }
        } catch {
          alert('전송 중 오류가 발생했습니다. 전화(031-947-1648)로 문의해 주세요.');
          submitBtn.disabled = false;
          submitBtn.textContent = '📋 견적 요청 제출하기';
        }
      } else {
        await sendSMS();
        alert(`✅ 견적 문의가 접수되었습니다!\n\n이름: ${name}\n연락처: ${phone}\n\n빠른 시일 내에 연락드리겠습니다.\n감사합니다! 🙏`);
        quoteForm.reset();
        submitBtn.disabled = false;
        submitBtn.textContent = '📋 견적 요청 제출하기';
      }
    });
  }

  // ── 7. 부드러운 앵커 스크롤 ─────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const headerH = header ? header.offsetHeight : 0;
        const top = target.getBoundingClientRect().top + window.scrollY - headerH - 16;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

});
