/**
 * NEXO Sistemas Constructivos
 * Tema claro/oscuro, menú, copiar datos de contacto, animaciones de scroll
 * y cambio de página sin recarga: el menú, el pie y el botón de WhatsApp
 * quedan fijos y solo se cambia el contenido. Cada página sigue teniendo su
 * propia dirección; si algo falla, se navega de la forma normal.
 */

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fineMouse = window.matchMedia('(pointer: fine)').matches;
  // En celulares el cambio de página es un fundido liviano; la transición de página completa (captura de pantalla) queda para PC
  const pageVT = () => Boolean(document.startViewTransition) && !reduceMotion && fineMouse;

  const header = document.querySelector('.site-header');
  const headerNav = document.querySelector('.header-nav');
  const mobileToggle = document.querySelector('.mobile-toggle');
  const themeToggle = document.getElementById('theme-toggle');
  const navLinks = document.querySelectorAll('.nav-link');
  const norm = (p) => p.replace(/index\.html$/, '');

  // ---------------------------------------------------------------- Tema
  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    }
  }
  applyTheme(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('nexo-theme', next); } catch (e) { /* sin almacenamiento */ }

      if (document.startViewTransition && !reduceMotion) {
        // Fundido suave: el tema nuevo aparece sobre el anterior
        root.classList.add('theme-vt');
        const transition = document.startViewTransition(() => applyTheme(next));
        transition.finished.then(() => root.classList.remove('theme-vt'), () => root.classList.remove('theme-vt'));
      } else {
        // Sin soporte: fundido de colores
        root.classList.add('theme-anim');
        applyTheme(next);
        setTimeout(() => root.classList.remove('theme-anim'), 500);
      }
    });
  }

  // ---------------------------------------------------------------- Menú móvil
  function setMenu(open) {
    if (!mobileToggle || !headerNav) return;
    headerNav.classList.toggle('active', open);
    const siteHeader = headerNav.closest('.site-header');
    if (siteHeader) siteHeader.classList.toggle('menu-open', open);
    // Alto exacto del contenido: la tarjeta termina de abrirse justo cuando llegan los botones
    headerNav.style.maxHeight = open && window.innerWidth <= 900 ? (headerNav.scrollHeight + 16) + 'px' : '';
    document.body.style.overflow = open ? 'hidden' : '';
    mobileToggle.setAttribute('aria-expanded', String(open));
    mobileToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => setMenu(!headerNav.classList.contains('active')));
    navLinks.forEach(link => link.addEventListener('click', () => setMenu(false)));
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900 && headerNav.classList.contains('active')) setMenu(false);
    });
    // Tocar fuera de la tarjeta cierra el menú
    const headerContainer = document.querySelector('.header-container');
    document.addEventListener('click', (e) => {
      if (headerNav.classList.contains('active') && headerContainer && !headerContainer.contains(e.target)) setMenu(false);
    });
  }

  // Copia con el método clásico (funciona también en direcciones sin https) o con la API moderna
  function legacyCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    area.remove();
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text));
    }
    return Promise.resolve(legacyCopy(text));
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMenu(false);
  });

  // ---------------------------------------------------------------- Scroll
  // Scroll 100 % nativo: la página no escucha la rueda ni mueve nada a mano, así corre fuera del hilo principal
  // y no se traba aunque haya 3D dibujando. La velocidad es la del sistema.
  const smooth = null;

  // las escenas fijas (data-anchor-stage) se alinean con el borde de arriba de la pantalla; el resto deja lugar al menú
  const anchorOffset = (el) => (el.hasAttribute('data-anchor-stage') ? 0 : 80);
  function scrollToElement(el) {
    const top = el.getBoundingClientRect().top + window.scrollY - anchorOffset(el);
    if (smooth) smooth.to(top);
    else window.scrollTo({ top, behavior: reduceMotion ? 'instant' : 'smooth' });
  }

  // ---------------------------------------------------------------- Header oculto al bajar + parallax
  let parallaxEls = [];
  let lastY = window.scrollY;
  let ticking = false;

  function frame() {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;

    header.classList.toggle('scrolled', y > 40);

    const menuOpen = headerNav && headerNav.classList.contains('active');
    const dy = y - lastY;
    if (y > 120 && dy > 3 && !menuOpen) {
      header.classList.add('is-hidden');
    } else if (dy < -3 || y <= 120 || menuOpen) {
      header.classList.remove('is-hidden');
    }
    // Solo se actualiza con movimientos grandes, para que el scroll lento también cuente
    if (Math.abs(dy) > 3) lastY = y;

    updateBuild(vh);

    // El botón flotante de WhatsApp sube sobre la cinta mientras ésta se ve en el borde de abajo
    const wa = document.querySelector('.floating-whatsapp');
    if (wa) {
      const strip = document.querySelector('.marquee');
      let shift = 0;
      if (strip) {
        const r = strip.getBoundingClientRect();
        const clamp = (v) => Math.min(Math.max(v, 0), r.height);
        shift = clamp(vh - r.top) - clamp(vh - r.bottom);
      }
      const away = shift > 4 && window.innerWidth < 600;
      const val = (window.innerWidth < 600 ? 0 : shift).toFixed(0) + 'px';
      if (wa.__away !== away) { wa.__away = away; wa.classList.toggle('wa-away', away); }
      if (wa.__val !== val) { wa.__val = val; wa.style.setProperty('--wa-shift', val); }
    }

    if (!reduceMotion && fineMouse) {
      parallaxEls.forEach(el => {
        const rect = el.parentElement.getBoundingClientRect();
        if (rect.bottom < -150 || rect.top > vh + 150) return;
        const center = rect.top + rect.height / 2;
        const shift = (vh / 2 - center) * parseFloat(el.dataset.parallax);
        el.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
      });
    }
  }
  function requestFrame() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(frame);
    }
  }
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', requestFrame);

  // ---------------------------------------------------------------- Lo propio de cada página
  let io = null;

  // Mensaje de WhatsApp según la página: el menú queda de la primera página, por eso se reescribe en cada cambio
  function applyWaText() {
    const main = document.querySelector('main');
    const text = main && main.dataset.waText;
    if (!text) return;
    document.querySelectorAll('a[href^="https://wa.me/"]').forEach(a => {
      a.href = a.href.split('?')[0] + '?text=' + encodeURIComponent(text);
    });
  }

  // Escenas: la imagen queda fija en pantalla y los pasos van apareciendo según lo que se avanzó por la sección.
  // Nada se mueve: el avance se calcula con la posición de la escena, sin pegar ni deslizar elementos.
  let scenes = [];
  let plays = [];
  function setSceneStep(sc, n) {
    if (n === sc.step) return;
    sc.step = n;
    sc.box.dataset.step = String(n);
    sc.steps.forEach(el => {
      const on = Number(el.dataset.step) === n;
      el.classList.toggle('is-active', on);
      if (on) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
    });
    sc.dots.forEach((d, i) => d.classList.toggle('on', i < n));
    sc.box.dispatchEvent(new CustomEvent('nexo-step', { detail: n }));
    sc.items.forEach(it => it.classList.toggle('is-on', (it.dataset.steps || '').split(' ').indexOf(String(n)) !== -1));
  }
  function updateScene(sc, vh) {
    const r = sc.box.getBoundingClientRect();
    const total = r.height - vh;
    if (total <= 0) return;
    const p = Math.min(Math.max(-r.top / total, 0), 1);
    const count = Number(sc.box.dataset.count) || sc.steps.length || 1;
    setSceneStep(sc, 1 + Math.min(count - 1, Math.floor(p * count)));
  }
  function updateBuild(vh) {
    scenes.forEach(sc => { if (!sc.auto) updateScene(sc, vh); });
  }
  // Selector de tipo de obra: cada una tiene su propio armado
  function wireTypeTabs(sc) {
    const tabs = Array.from(sc.box.querySelectorAll('[data-type-tab]'));
    if (!tabs.length) return;
    const showType = (type) => {
      sc.box.dataset.type = type;
      sc.box.dispatchEvent(new CustomEvent('nexo-type', { detail: type }));
      tabs.forEach(t => {
        const on = t.dataset.typeTab === type;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-pressed', String(on));
      });
      sc.box.querySelectorAll('[data-type]').forEach(el => { if (el !== sc.box) el.hidden = el.dataset.type !== type; });
      sc.box.querySelectorAll('[data-for]').forEach(el => { el.hidden = el.dataset.for !== type; });
    };
    tabs.forEach(t => t.addEventListener('click', () => {
      if (sc.stop) sc.stop();
      showType(t.dataset.typeTab);
      if (sc.onType) sc.onType();
    }));
    showType(sc.box.dataset.type || tabs[0].dataset.typeTab);
  }

  function makeScene(box) {
    return {
      box,
      step: 0,
      steps: Array.from(box.querySelectorAll('.build-step')),
      dots: Array.from(box.querySelectorAll('.build-dots i')),
      items: Array.from(box.querySelectorAll('.scene-item')),
    };
  }

  // Armado con botones (sin depender del scroll): siguiente, anterior y reproducción completa
  function initPlay() {
    plays.forEach(pl => { if (pl.timer) clearInterval(pl.timer); });
    plays = Array.from(document.querySelectorAll('[data-play]')).map(box => {
      const sc = makeScene(box);
      const count = Number(box.dataset.count) || 1;
      const next = box.querySelector('[data-play-next]');
      const prev = box.querySelector('[data-play-prev]');
      const all = box.querySelector('[data-play-all]');
      const label = (el, text) => { const sp = el && el.querySelector('span'); if (sp) sp.textContent = text; };
      sc.timer = null;
      sc.stop = () => { if (sc.timer) { clearInterval(sc.timer); sc.timer = null; } label(all, 'Ver todo el armado'); };
      const go = (n) => { setSceneStep(sc, n); label(next, n >= count ? 'Volver a empezar' : 'Armar el siguiente paso'); if (prev) prev.disabled = n <= 1; };
      box.classList.add('build-js');
      sc.onType = () => go(1);
      wireTypeTabs(sc);
      sc.steps.forEach(el => el.addEventListener('click', () => { sc.stop(); go(Number(el.dataset.step)); }));
      box.addEventListener('nexo-goto', e => { sc.stop(); go(Number(e.detail)); });
      if (next) next.addEventListener('click', () => { sc.stop(); go(sc.step >= count ? 1 : sc.step + 1); });
      if (prev) prev.addEventListener('click', () => { sc.stop(); go(Math.max(1, sc.step - 1)); });
      if (all) all.addEventListener('click', () => {
        if (sc.timer) { sc.stop(); return; }
        go(1);
        label(all, 'Detener');
        sc.timer = setInterval(() => {
          if (sc.step >= count) { sc.stop(); return; }
          go(sc.step + 1);
        }, 1800);
      });
      go(1);
      return sc;
    });
  }

  // Escenas que avanzan solas: recorren los pasos, quedan completas un rato y se vuelven a armar
  let autoTimers = [];
  let autoIO = null;
  function runAuto(sc) {
    const count = Number(sc.box.dataset.count) || sc.steps.length || 1;
    const tick = () => {
      if (!sc.box.isConnected) return;
      if (sc.paused || sc.fs || !sc.visible || document.hidden || Date.now() < sc.pauseUntil) { autoTimers.push(setTimeout(tick, 700)); return; }
      const n = sc.step >= count ? 1 : sc.step + 1;
      setSceneStep(sc, n);
      const dwell = Number(sc.box.dataset.dwell) || 3600;
      autoTimers.push(setTimeout(tick, n >= count ? Math.max(7000, dwell) : dwell));
    };
    autoTimers.push(setTimeout(tick, 3200));
  }

  function initBuild() {
    autoTimers.forEach(t => clearTimeout(t));
    autoTimers = [];
    if (autoIO) { autoIO.disconnect(); autoIO = null; }
    scenes = Array.from(document.querySelectorAll('[data-build]')).map(makeScene);
    scenes.forEach(sc => {
      if (reduceMotion) {
        sc.box.classList.add('build-static');
        sc.steps.forEach(el => el.classList.remove('is-active'));
        return;
      }
      sc.box.classList.add('build-js');
      if (sc.box.hasAttribute('data-auto')) {
        // avanza sola; tocar un paso lo muestra y frena el recorrido unos segundos
        sc.auto = true;
        sc.visible = false;
        sc.pauseUntil = 0;
        sc.paused = false;
        const tg = sc.box.querySelector('.auto-toggle');
        if (tg) tg.addEventListener('click', () => {
          sc.paused = !sc.paused;
          tg.setAttribute('aria-pressed', String(sc.paused));
          tg.textContent = sc.paused ? 'Reanudar el avance' : 'Pausar el avance';
        });
        sc.steps.forEach(el => el.addEventListener('click', () => {
          setSceneStep(sc, Number(el.dataset.step));
          sc.pauseUntil = Date.now() + 14000;
        }));
        sc.box.addEventListener('nexo-goto', e => { setSceneStep(sc, Number(e.detail)); });
        sc.box.addEventListener('nexo-fs', e => { sc.fs = !!e.detail; });
        wireTypeTabs(sc);
        setSceneStep(sc, 1);
        if (!autoIO) {
          autoIO = new IntersectionObserver((entries) => {
            entries.forEach(e => { const s2 = scenes.find(x => x.box === e.target); if (s2) s2.visible = e.isIntersecting; });
          }, { threshold: 0.3 });
        }
        autoIO.observe(sc.box);
        runAuto(sc);
        return;
      }
      // Tocar un paso lleva la página hasta ese punto
      sc.steps.forEach(el => el.addEventListener('click', () => {
        const r = sc.box.getBoundingClientRect();
        const total = r.height - window.innerHeight;
        const n = Number(el.dataset.step);
        window.scrollTo({ top: window.scrollY + r.top + ((n - 0.5) / (Number(sc.box.dataset.count) || sc.steps.length)) * total, behavior: 'smooth' });
      }));
      wireTypeTabs(sc);
      setSceneStep(sc, 1);
      updateScene(sc, window.innerHeight);
    });
    if (reduceMotion) scenes = [];
    initPlay();
  }

  // Dibujos del inicio: se arman, quedan completos un rato y se vuelven a armar, en ciclo.
  // Solo corren mientras están a la vista.
  let drawIO = null;
  let drawTimers = [];
  function initDraws() {
    if (drawIO) { drawIO.disconnect(); drawIO = null; }
    drawTimers.forEach(t => clearTimeout(t));
    drawTimers = [];
    if (reduceMotion) return;
    const boxes = Array.from(document.querySelectorAll('.draw-box'));
    if (!boxes.length) return;
    const later = (fn, ms) => { drawTimers.push(setTimeout(fn, ms)); };
    const cycle = (box) => {
      if (!box.isConnected) return;
      if (!box.dataset.visible || document.hidden) { later(() => cycle(box), 800); return; }
      box.classList.remove('is-clearing');
      void box.offsetWidth;
      box.classList.add('is-built');                       // se arma, despacio
      later(() => {
        box.classList.remove('is-built');
        box.classList.add('is-clearing');                  // se desvanece
        later(() => {
          box.classList.remove('is-clearing');             // vuelve al estado inicial
          later(() => cycle(box), 500);                    // y se arma de nuevo
        }, 1000);
      }, 15500);                                           // se arma en unos 8 s y queda completo unos 7 s
    };
    drawIO = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const box = e.target;
        const was = box.dataset.visible;
        if (e.isIntersecting) box.dataset.visible = '1'; else delete box.dataset.visible;
        if (e.isIntersecting && !was && !box.dataset.running) { box.dataset.running = '1'; cycle(box); }
      });
    }, { threshold: 0.5 });
    boxes.forEach(b => { b.classList.add('draw-anim'); drawIO.observe(b); });
  }

  // "Cómo es por dentro": en celular se elige qué tarjeta ver, una a la vez
  function initDrawTabs() {
    document.querySelectorAll('.draw-tabs').forEach(box => {
      if (box.dataset.bound) return;
      box.dataset.bound = '1';
      const grid = box.parentElement.querySelector('.draw-grid');
      if (!grid) return;
      const btns = Array.from(box.querySelectorAll('button'));
      btns.forEach((b, i) => b.addEventListener('click', () => {
        grid.dataset.tab = String(i);
        btns.forEach(x => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
      }));
    });
  }

  const REVEAL_SELECTORS =
    '.section-header-row, .compare-table tbody tr, .compare-note, .cause, .service-row, .reasons-cta, ' +
    '.about-content, .pillar-item, .step-card, .contact-info-card, .contact-map-card, ' +
    '.mini-row, .home-compare-more, .about-teaser > *, .cta-band-inner > *';

  // La herramienta de cómputo se descarga solo en su página (también cuando se llega desde otra por la navegación interna)
  let computoLoading = false;
  function loadComputo() {
    const m = document.querySelector('[data-computo]');
    if (!m) return;
    if (window.NexoComputo) { window.NexoComputo.init(); return; }
    if (computoLoading) return;
    computoLoading = true;
    const sc = document.createElement('script');
    sc.src = m.dataset.computoSrc || 'js/computo.js';
    sc.onload = () => { computoLoading = false; if (window.NexoComputo) window.NexoComputo.init(); };
    sc.onerror = () => { computoLoading = false; };
    document.head.appendChild(sc);
  }

  // Paso a paso de la colocación: pestañas Pared / Cielorraso
  function initGuia() {
    document.querySelectorAll('[data-guia]').forEach(box => {
      if (box.dataset.bound) return;
      box.dataset.bound = '1';
      const tabs = Array.from(box.querySelectorAll('[data-guia-tab]'));
      const panels = Array.from(box.querySelectorAll('[data-guia-panel]'));
      const show = (name, scroll) => {
        tabs.forEach(t => { const on = t.dataset.guiaTab === name; t.classList.toggle('is-active', on); t.setAttribute('aria-pressed', String(on)); });
        panels.forEach(p => { p.hidden = p.dataset.guiaPanel !== name; });
        // al cambiar de pestaña estando abajo, se vuelve al principio de la guía (si ya se ve el principio, no se mueve)
        if (scroll) {
          const bar = box.querySelector('.type-tabs'), panel = panels.find(p => !p.hidden), hdr = document.getElementById('header');
          if (bar && panel) {
            const y = panel.getBoundingClientRect().top + window.scrollY - bar.getBoundingClientRect().height - (hdr ? hdr.getBoundingClientRect().height : 0) - 6;
            if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
          }
        }
      };
      tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.guiaTab, true)));
      show(tabs.length ? tabs[0].dataset.guiaTab : '');
      // Los dibujos se pueden ampliar: tocar o Enter abre una vista grande; Escape o tocar afuera la cierra
      box.querySelectorAll('.guia-fig').forEach(fig => {
        const svg = fig.querySelector('svg');
        if (!svg) return;
        fig.tabIndex = 0;
        fig.setAttribute('role', 'button');
        fig.setAttribute('aria-label', 'Ampliar el dibujo: ' + (svg.getAttribute('aria-label') || ''));
        const open = () => {
          const ov = document.createElement('div');
          ov.className = 'gd-zoom';
          ov.setAttribute('role', 'dialog');
          ov.setAttribute('aria-modal', 'true');
          const card = document.createElement('div');
          card.className = 'gd-zoom-card';
          card.appendChild(svg.cloneNode(true));
          const capEl = fig.querySelector('figcaption');
          if (capEl) { const cp = document.createElement('p'); cp.className = 'gd-zoom-cap'; cp.textContent = capEl.textContent; card.appendChild(cp); }
          const close = document.createElement('button');
          close.type = 'button';
          close.className = 'gd-zoom-close';
          close.textContent = 'Cerrar';
          ov.appendChild(card); ov.appendChild(close);
          const off = () => { document.removeEventListener('keydown', onKey, true); ov.remove(); fig.focus(); };
          const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); off(); } };
          ov.addEventListener('click', off);
          document.addEventListener('keydown', onKey, true);
          document.body.appendChild(ov);
          close.focus();
        };
        fig.addEventListener('click', open);
        fig.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
    });
  }

  function initPage() {
    parallaxEls = [];   // sin parallax: el scroll queda 100 % nativo
    applyWaText();
    initGuia();
    initBuild();
    initDraws();
    initDrawTabs();
    if (window.NexoGL) window.NexoGL.scan();
    loadComputo();
    requestFrame();

    // Aparición de bloques al entrar en pantalla
    if (io) io.disconnect();
    if (root.classList.contains('reveal-ready')) {
      io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

      const seen = new Map();
      document.querySelectorAll(REVEAL_SELECTORS).forEach(el => {
        if (el.hasAttribute('data-reveal')) return;
        const key = el.parentElement;
        const idx = seen.get(key) || 0;
        seen.set(key, idx + 1);
        const step = Math.min(idx, 3);
        el.setAttribute('data-reveal', '');
        el.style.setProperty('--d', `${step * 60}ms`);
        if (el.getBoundingClientRect().top < window.innerHeight) {
          // ya está a la vista: se muestra de una, sin animación
          el.style.transition = 'none';
          el.classList.add('is-visible');
          requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = ''; }));
        } else {
          io.observe(el);
        }
      });
    }
    requestFrame();
  }

  // ---------------------------------------------------------------- Clics: contacto, enlaces internos y cambio de página
  const spaEnabled = !document.querySelector('meta[name="robots"][content="noindex"]');
  let currentPath = window.location.pathname;
  const cache = new Map();
  let navigating = false;

  function internalUrl(a) {
    try {
      const url = new URL(a.href, window.location.href);
      return url.origin === window.location.origin ? url : null;
    } catch (err) {
      return null;
    }
  }

  // Trae el HTML de otra página (queda guardado para no pedirlo dos veces)
  function load(url) {
    const key = norm(url.pathname);
    if (!cache.has(key)) {
      const p = fetch(url.pathname, { credentials: 'same-origin' }).then(r => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      });
      p.catch(() => cache.delete(key));
      cache.set(key, p);
    }
    return cache.get(key);
  }

  function syncMeta(doc) {
    [['meta[name="description"]', 'content'], ['meta[property="og:title"]', 'content'],
     ['meta[property="og:url"]', 'content'], ['link[rel="canonical"]', 'href']].forEach(([sel, attr]) => {
      const now = document.querySelector(sel);
      const next = doc.querySelector(sel);
      if (now && next) now.setAttribute(attr, next.getAttribute(attr));
    });
  }

  function swap(doc, url, push) {
    try {
      document.title = doc.title;
      syncMeta(doc);

      const oldMain = document.querySelector('main');
      const newMain = document.importNode(doc.querySelector('main'), true);
      newMain.setAttribute('tabindex', '-1');
      root.classList.add('no-intro');
      oldMain.replaceWith(newMain);

      // Botón flotante de WhatsApp: no todas las páginas lo traen
      document.querySelectorAll('.floating-whatsapp').forEach(n => n.remove());
      const anchor = document.querySelector('script[src*="main.js"]');
      doc.querySelectorAll('.floating-whatsapp').forEach(n => {
        document.body.insertBefore(document.importNode(n, true), anchor);
      });
      setMenu(false);

      if (push) window.history.pushState({ nexo: true }, '', url.href);
      currentPath = window.location.pathname;

      // Enlace activo del menú
      navLinks.forEach(link => {
        const target = internalUrl(link);
        const same = target && norm(target.pathname) === norm(url.pathname);
        link.classList.toggle('active', Boolean(same));
        if (same) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });

      // Arriba de todo (o en el ancla pedida)
      if (smooth) smooth.stop();
      window.scrollTo({ top: 0, behavior: 'instant' });
      header.classList.remove('is-hidden');
      initPage();
      if (url.hash) {
        const el = document.getElementById(url.hash.slice(1));
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - anchorOffset(el), behavior: 'instant' });
      }
      newMain.focus({ preventScroll: true });
      if (!pageVT() && !reduceMotion) newMain.classList.add('swap-in');
    } catch (err) {
      window.location.href = url.href;
    }
  }

  async function go(url, push) {
    if (navigating) return;
    navigating = true;
    let doc;
    try {
      const html = await load(url);
      doc = new DOMParser().parseFromString(html, 'text/html');
      if (!doc.querySelector('main')) throw new Error('sin contenido');
    } catch (err) {
      navigating = false;
      window.location.href = url.href;
      return;
    }
    if (pageVT()) {
      const transition = document.startViewTransition(() => swap(doc, url, push));
      transition.finished.then(() => { navigating = false; }, () => { navigating = false; });
    } else {
      swap(doc, url, push);
      navigating = false;
    }
  }

  document.addEventListener('click', (e) => {
    // Copiar correo o teléfono
    const copyBtn = e.target.closest && e.target.closest('.copy-btn');
    if (copyBtn) {
      copyText(copyBtn.dataset.copy).then(ok => {
        copyBtn.textContent = ok ? 'Copiado' : 'No se pudo';
        copyBtn.classList.toggle('is-copied', ok);
        setTimeout(() => {
          copyBtn.textContent = copyBtn.dataset.label || 'Copiar';
          copyBtn.classList.remove('is-copied');
        }, 1800);
      });
      return;
    }
    // Enlaces
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    const url = internalUrl(a);
    if (!url) return;

    if (norm(url.pathname) === norm(window.location.pathname)) {
      // Misma página: anclas con desplazamiento suave, o volver arriba
      if (url.hash) {
        const el = document.getElementById(url.hash.slice(1));
        if (el) {
          e.preventDefault();
          scrollToElement(el);
          window.history.pushState(null, '', url.hash);
        }
      } else {
        e.preventDefault();
        if (smooth) smooth.to(0);
        else window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
      }
      return;
    }

    if (!spaEnabled) return;
    e.preventDefault();
    go(url, true);
  });

  window.addEventListener('popstate', () => {
    if (!spaEnabled) return;
    const url = new URL(window.location.href);
    if (norm(url.pathname) === norm(currentPath)) return; // solo cambió el ancla
    go(url, false);
  });

  // Precarga: las demás páginas se piden en segundo plano, así el cambio es inmediato
  if (spaEnabled) {
    const warm = () => {
      navLinks.forEach(link => {
        const url = internalUrl(link);
        if (url && norm(url.pathname) !== norm(window.location.pathname)) load(url).catch(() => {});
      });
    };
    if (window.requestIdleCallback) window.requestIdleCallback(warm, { timeout: 2500 });
    else setTimeout(warm, 1500);

    document.addEventListener('pointerover', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      const url = a && internalUrl(a);
      if (url && norm(url.pathname) !== norm(window.location.pathname)) load(url).catch(() => {});
    }, { passive: true });
  }

  // ---------------------------------------------------------------- Arranque
  initPage();
  frame();
  window.__nexoReady = true;
});
