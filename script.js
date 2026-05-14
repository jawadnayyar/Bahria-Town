/* =====================================================================
   Bahria + DAO Proptech — interactivity
   ===================================================================== */

(function () {
  'use strict';

  // ============================================================
  // UTILS
  // ============================================================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function formatNumber(n, opts = {}) {
    const { decimal = 0, format = null } = opts;
    if (format === 'm') {
      const m = n / 1000000;
      return m >= 10 ? Math.round(m).toString() : m.toFixed(1);
    }
    if (decimal > 0) {
      return n.toFixed(decimal);
    }
    // Integer-style number. Round first, then locale format.
    const rounded = Math.round(n);
    if (rounded >= 1000) {
      return rounded.toLocaleString('en-US');
    }
    return rounded.toString();
  }

  // ============================================================
  // ANIMATED NUMBER COUNTERS (intersection-based)
  // ============================================================
  function initCounters() {
    const els = $$('[data-target]');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.dataset.counted) return;
        el.dataset.counted = '1';

        const target = parseFloat(el.dataset.target);
        const decimal = parseInt(el.dataset.decimal || '0', 10);
        const format = el.dataset.format || null;
        const duration = 1600;
        const start = performance.now();

        const tick = (now) => {
          const t = Math.min(1, (now - start) / duration);
          // ease-out-cubic
          const eased = 1 - Math.pow(1 - t, 3);
          const current = target * eased;
          el.textContent = formatNumber(current, { decimal, format });
          if (t < 1) requestAnimationFrame(tick);
          else el.textContent = formatNumber(target, { decimal, format });
        };
        requestAnimationFrame(tick);
        io.unobserve(el);
      });
    }, { threshold: 0.4, rootMargin: '0px 0px -10% 0px' });

    els.forEach((el) => io.observe(el));
  }

  // ============================================================
  // GENERIC SCROLL REVEAL (.reveal becomes .is-visible)
  // ============================================================
  function initReveal() {
    const reveals = $$('.reveal, .scenario, .persona-tile, .unlock-card, .world-tile, .activate-pillar');
    reveals.forEach((el) => el.classList.add('reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const delay = parseInt(el.dataset.delay || (i * 80), 10);
        setTimeout(() => el.classList.add('is-visible'), delay);
        io.unobserve(el);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => io.observe(el));
  }

  // ============================================================
  // HEADER NAV ACTIVE STATE
  // ============================================================
  function initHeaderNav() {
    const navLinks = $$('.header-nav a');
    const sections = navLinks.map((a) => {
      const id = a.getAttribute('href').slice(1);
      return { link: a, section: document.getElementById(id) };
    }).filter((x) => x.section);

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((a) => {
            a.classList.toggle('active', a.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });

    sections.forEach((x) => io.observe(x.section));
  }

  // ============================================================
  // PHASE 2: TILE GRID + SLIDER
  // ============================================================
  function initSeed() {
    const grid = $('#tileGrid');
    const slider = $('#sqftSlider');
    const tileCount = $('#tileCount');
    const sqftValue = $('#sqftValue');
    const priceValue = $('#priceValue');
    if (!grid || !slider) return;

    const TOTAL_TILES = 20 * 12; // 240 visual tiles
    grid.innerHTML = '';
    for (let i = 0; i < TOTAL_TILES; i++) {
      const t = document.createElement('div');
      t.className = 'tile';
      grid.appendChild(t);
    }

    function update() {
      const sqft = parseInt(slider.value, 10);
      const ratio = sqft / 5000;
      const activeCount = Math.max(2, Math.round(TOTAL_TILES * ratio));

      const tiles = grid.children;
      // Shuffle order each update for visual interest
      const indices = Array.from({ length: TOTAL_TILES }, (_, i) => i);
      // Use a deterministic seeded order based on sqft so it's stable
      for (let i = TOTAL_TILES - 1; i > 0; i--) {
        const j = Math.floor(((sqft * 9301 + 49297) % 233280) / 233280 * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      Array.from(tiles).forEach((t) => t.classList.add('tile-off'));
      for (let i = 0; i < activeCount; i++) {
        tiles[indices[i] || i].classList.remove('tile-off');
      }

      sqftValue.textContent = sqft.toLocaleString('en-US');
      tileCount.textContent = sqft.toLocaleString('en-US');

      // Price = PKR 12,000 per sqft. Format as lakh / crore
      const pkr = sqft * 12000;
      let formatted;
      if (pkr >= 10000000) {
        formatted = 'PKR ' + (pkr / 10000000).toFixed(2) + ' cr';
      } else {
        formatted = 'PKR ' + (pkr / 100000).toFixed(0) + ' lakh';
      }
      priceValue.textContent = formatted;
    }

    slider.addEventListener('input', update);
    update();
  }

  // ============================================================
  // PHASE 3: MAP DOTS (sparse vs dense) on new Pakistan map (400x480)
  // ============================================================
  function initMaps() {
    const sparseEl = $('#sparseDots');
    const denseEl = $('#denseDots');
    if (!sparseEl || !denseEl) return;

    // City coordinates for new Pakistan viewBox 0 0 400 480
    // Approximate positions of major Pakistani cities
    const cities = [
      // Islamabad/Rawalpindi area (top, slightly right of center)
      { x: 220, y: 95 }, { x: 222, y: 102 },
      // Lahore (right of center)
      { x: 245, y: 145 },
      // Karachi (bottom left)
      { x: 130, y: 360 }, { x: 135, y: 365 },
      // Multan (center-left of middle)
      { x: 180, y: 200 },
      // Peshawar (top left)
      { x: 145, y: 90 },
      // Quetta (left middle)
      { x: 100, y: 230 },
      // Faisalabad
      { x: 210, y: 165 },
      // Hyderabad
      { x: 145, y: 320 },
      // Gujranwala
      { x: 248, y: 135 },
      // Sialkot
      { x: 252, y: 130 },
      // Sargodha
      { x: 215, y: 145 },
    ];

    // Sparse: ~13 dots from above, pulse-animated
    cities.forEach((c, i) => {
      const dot = document.createElement('div');
      dot.style.left = (c.x / 400 * 100) + '%';
      dot.style.top = (c.y / 480 * 100) + '%';
      dot.style.animationDelay = (i * 60) + 'ms';
      sparseEl.appendChild(dot);
    });

    // Dense: many more dots, clustered around cities + tehsils everywhere
    const denseDots = [];
    // Add cluster around each city
    cities.forEach((c) => {
      for (let k = 0; k < 12; k++) {
        denseDots.push({
          x: c.x + (Math.random() - 0.5) * 40,
          y: c.y + (Math.random() - 0.5) * 40,
        });
      }
    });
    // Add scatter of tehsil-level coverage across country
    // Pakistan map bounds roughly 50-340 x, 30-400 y in viewBox 400x480
    for (let k = 0; k < 220; k++) {
      const x = 60 + Math.random() * 270;
      const y = 50 + Math.random() * 340;
      // Skip if outside rough country area (simple ellipse check)
      const dx = (x - 200) / 150;
      const dy = (y - 220) / 180;
      if (dx * dx + dy * dy > 1.1) continue;
      denseDots.push({ x, y });
    }

    // Reveal denseDots only when section is in view
    const denseObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        denseDots.forEach((c, i) => {
          const dot = document.createElement('div');
          dot.style.left = (c.x / 400 * 100) + '%';
          dot.style.top = (c.y / 480 * 100) + '%';
          dot.style.animationDelay = (i * 4) + 'ms';
          denseEl.appendChild(dot);
        });
        denseObserver.disconnect();
      });
    }, { threshold: 0.3 });
    denseObserver.observe(denseEl);
  }

  // ============================================================
  // PHASE 4: TIMELINE PROGRESS
  // ============================================================
  function initTimeline() {
    const track = $('#trackProgress');
    if (!track) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Progress to "2026" position (last marker out of 6, so ~100%)
          // We want it to stop at the "now" marker (2026, position 6 of 6)
          track.style.width = '92%';
          io.disconnect();
        }
      });
    }, { threshold: 0.4 });
    io.observe(track.parentElement);

    // Diaspora bars fill
    const fills = $$('.dflow-fill');
    const fillObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          fills.forEach((f) => {
            const w = f.dataset.width;
            f.style.width = w + '%';
          });
          fillObserver.disconnect();
        }
      });
    }, { threshold: 0.3 });
    if (fills[0]) fillObserver.observe(fills[0].closest('.diaspora-flow'));
  }

  // ============================================================
  // PHASE 5: PHONE INTERACTIVITY + SCROLL PARALLAX
  // ============================================================
  function initPhone() {
    const stage = $('#phoneStage');
    const mockup = $('#phoneMockup');
    if (!stage || !mockup) return;

    // --- View switching ---
    const views = $$('.phone-view');
    function showView(name) {
      views.forEach((v) => v.classList.toggle('phone-view-active', v.dataset.view === name));
    }

    // Listing -> Detail
    $$('.listing').forEach((listing) => {
      listing.addEventListener('click', (e) => {
        e.preventDefault();
        const name = listing.dataset.name || 'Bahria Heights, Apt 4B';
        const loc = listing.dataset.loc || '';
        const price = listing.dataset.price || '11200';
        const type = listing.dataset.type || 'house';

        $('#detailTitle').textContent = name;
        const meta = $('#detailMeta');
        // Use innerHTML to render &middot; entity
        meta.innerHTML = loc;
        $('#detailPrice').textContent = 'PKR ' + parseInt(price).toLocaleString('en-US') + '/sqft';

        // Swap hero icon
        const hero = $('#detailHeroSvg');
        const useEl = hero.querySelector('use');
        useEl.setAttribute('href', '#i-' + type);

        // Reset stepper
        $('#stepperValue').textContent = '100';
        updateDetailTotal(100, parseInt(price));

        showView('detail');
      });
    });

    // App CTA button -> click the first visible listing
    const appCtaBuy = $('#appCtaBuy');
    if (appCtaBuy) {
      appCtaBuy.addEventListener('click', () => {
        const first = $$('.listing').find((l) => l.style.display !== 'none');
        if (first) first.click();
      });
    }

    // Tabs filter listings by category
    const greetingEl = $('#appGreeting');
    const greetings = {
      apt:  'Three new apartments in Bahria.',
      com:  'Three commercial spaces. Live now.',
      plot: 'Three plots ready to tokenize.'
    };
    $$('.app-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.app-tab').forEach((t) => t.classList.remove('app-tab-active'));
        tab.classList.add('app-tab-active');
        const cat = tab.dataset.tab;
        $$('.listing').forEach((l) => {
          l.style.display = (l.dataset.category === cat) ? '' : 'none';
        });
        if (greetingEl) greetingEl.textContent = greetings[cat] || '';
      });
    });
    // Initial filter: show only the "apt" category since Apartments is the active tab
    $$('.listing').forEach((l) => {
      if (l.dataset.category !== 'apt') l.style.display = 'none';
    });

    // Stepper
    let currentQty = 100;
    let currentPrice = 11200;
    function updateDetailTotal(qty, price) {
      const total = qty * price;
      let formatted;
      if (total >= 10000000) {
        formatted = 'PKR ' + (total / 10000000).toFixed(2) + ' cr';
      } else {
        formatted = 'PKR ' + (total / 100000).toFixed(1) + ' lakh';
      }
      $('#detailTotal').textContent = formatted;
    }

    $$('.stepper-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = parseInt(btn.dataset.step, 10);
        currentQty = Math.max(100, currentQty + step);
        $('#stepperValue').textContent = currentQty;
        const priceText = $('#detailPrice').textContent.replace(/[^\d]/g, '');
        currentPrice = parseInt(priceText) || 11200;
        updateDetailTotal(currentQty, currentPrice);
      });
    });

    // Confirm
    $$('[data-action="confirm"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        $('#confirmAsset').textContent = $('#detailTitle').textContent;
        $('#confirmQty').textContent = currentQty + ' sqft';
        showView('confirmed');
      });
    });

    // Back
    $$('[data-action="back"]').forEach((btn) => {
      btn.addEventListener('click', () => showView('listings'));
    });

    // --- Scroll-tied parallax ---
    // Phone moves slightly with scroll while section is in view (subtle).
    // Combined with a tiny continuous bob.
    let bobPhase = 0;
    let scrollOffset = 0;
    let isInView = false;

    const stageIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { isInView = entry.isIntersecting; });
    }, { threshold: 0 });
    stageIO.observe(stage);

    function updatePhone() {
      if (isInView) {
        const rect = stage.getBoundingClientRect();
        const winH = window.innerHeight;
        // -1 (just entering bottom) ... +1 (just leaving top)
        const progress = (winH / 2 - (rect.top + rect.height / 2)) / (winH / 2 + rect.height / 2);
        scrollOffset = progress * 90; // up to 90px translate, much more visible
      }
      bobPhase += 0.012;
      const bobY = Math.sin(bobPhase) * 2;
      const tiltX = Math.cos(bobPhase * 0.7) * 0.6;
      mockup.style.transform = `translateY(${-scrollOffset + bobY}px)`;
      const frame = mockup.querySelector('.phone-frame');
      if (frame) {
        frame.style.transform = `rotateY(${-8 + tiltX}deg) rotateX(${4 + tiltX * 0.3}deg)`;
      }
      requestAnimationFrame(updatePhone);
    }
    requestAnimationFrame(updatePhone);
  }

  // ============================================================
  // PHASE 5: REDEMPTION OPTIONS
  // ============================================================
  function initRedemption() {
    const options = $$('.redeem-option');
    options.forEach((opt) => {
      opt.addEventListener('click', () => {
        options.forEach((o) => o.classList.remove('redeem-option-active'));
        opt.classList.add('redeem-option-active');
      });
    });
  }

  // ============================================================
  // FORM: Formspree AJAX submission
  // ============================================================
  function initForm() {
    const form = $('#activationForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = $('#formSubmit');
      const successEl = $('#formSuccess');
      const bodyEl = $('#formBody');
      const submitText = submitBtn.querySelector('.submit-text');
      const originalText = submitText.textContent;
      submitBtn.disabled = true;
      submitText.textContent = 'Sending...';

      try {
        const formData = new FormData(form);
        const response = await fetch(form.action, {
          method: 'POST',
          body: formData,
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          bodyEl.style.display = 'none';
          successEl.classList.add('is-visible');
          form.reset();
        } else {
          throw new Error('Submit failed');
        }
      } catch (err) {
        console.error(err);
        submitBtn.disabled = false;
        submitText.textContent = originalText;
        alert('Something went wrong. Please try again or email us directly.');
      }
    });
  }

  // ============================================================
  // SMOOTH SCROLL FOR ANCHOR LINKS
  // ============================================================
  function initSmoothScroll() {
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        if (href.length <= 1) return;
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        const offsetTop = target.getBoundingClientRect().top + window.pageYOffset - 24;
        window.scrollTo({ top: offsetTop, behavior: 'smooth' });
      });
    });
  }

  // ============================================================
  // BOOT
  // ============================================================
  function boot() {
    initSmoothScroll();
    initHeaderNav();
    initReveal();
    initCounters();
    initSeed();
    initMaps();
    initTimeline();
    initPhone();
    initRedemption();
    initForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
