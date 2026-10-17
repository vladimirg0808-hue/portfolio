(() => {
  'use strict';
  const projects = Array.isArray(window.PORTFOLIO_PROJECTS) ? window.PORTFOLIO_PROJECTS : [];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const state = { manifest: [], config: {}, activeProject: 'all', query: '', lightboxItems: [], lightboxIndex: 0, priorFocus: null };
  const categoryNames = { photography: 'Фотосъёмка', video: 'Видеосъёмка', clips: 'Клипы и монтаж', social: 'Контент для соцсетей', advertising: 'Рекламный контент', graphics: 'Афиши и графика', identity: 'Логотипы и айдентика', landscape: 'Ландшафтное проектирование', other: 'Другое' };
  const categoryAliases = { posters: 'graphics', design: 'identity', reportage: 'photography', sport: 'photography', photo: 'photography' };

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function getProject(slug) { return projects.find(project => project.slug === slug || project.id === slug); }
  function getProjectFiles(slug) {
    const isPoster = item => item.category === 'graphics' || /\/posters\//i.test(item.relativePath || '');
    // Видео и клипы остаются в начале галереи во всех проектах.
    // Только в «МЦ Импульс» афиши ставим следом за видео, но перед фотографиями.
    const displayPriority = item => {
      if (item.mediaType === 'video') return 0;
      if (slug === 'mc-impuls' && isPoster(item)) return 1;
      return 2;
    };
    return state.manifest.filter(item => item.project === slug).sort((a, b) =>
      displayPriority(a) - displayPriority(b) ||
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
      a.filename.localeCompare(b.filename, 'ru', { numeric: true })
    );
  }
  function categoryLabel(key) { const normalized = categoryAliases[key] || key; return categoryNames[normalized] || (normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Материал'); }
  function mediaLabel(item) { return item.mediaType === 'video' ? 'Видео' : item.mediaType === 'image' ? 'Фотография' : 'Проект'; }
  function getProjectSearchText(project) {
    return [project.title, project.subtitle, project.lead, project.role, project.context, project.detail, ...(project.tags || []), ...(project.categories || [])].join(' ').toLowerCase();
  }
  function artMarkup(project, extraClass = '') {
    return `<div class="art-shell ${project.coverClass || ''} ${extraClass}" aria-hidden="true">
      <div class="art-grid"></div><div class="art-orbit"></div>
      <span class="art-code">${escapeHTML(project.eyebrow || 'VISUAL STORY')}</span>
      <span class="art-mark">${escapeHTML(project.mark || '✳')}</span>
      <span class="art-word">${project.coverTitle || escapeHTML(project.shortTitle || project.title)}</span>
    </div>`;
  }
  function renderFeatured() {
    const target = $('#featured-grid');
    if (!target) return;
    const chosen = ['ural', 'pererozhdenie', 'gelendzhik-golf-resort'].map(getProject).filter(Boolean);
    target.innerHTML = chosen.map(project => `
      <article class="feature-card reveal" role="link" tabindex="0" data-open-project="${project.slug}" aria-label="Открыть проект ${escapeHTML(project.title)}">
        <div class="feature-art">${artMarkup(project)}<span class="art-index">${escapeHTML(project.number)} / ${String(projects.length).padStart(2, '0')}</span></div>
        <div class="feature-meta"><div><h3 class="feature-title">${escapeHTML(project.title)}</h3><p class="feature-subtitle">${escapeHTML(project.subtitle)}</p></div><span class="feature-arrow" aria-hidden="true">↗</span></div>
      </article>`).join('');
    observeReveals();
  }
  function populateProjectFilter() {
    const select = $('#project-filter');
    if (!select) return;
    select.innerHTML = '<option value="all">Все проекты</option>' + projects.map(project => `<option value="${project.slug}">${escapeHTML(project.title)}</option>`).join('');
  }
  function matchesQuery(project) {
    if (!state.query) return true;
    return getProjectSearchText(project).includes(state.query);
  }
  function getVisibleProjects() {
    let items = projects.filter(matchesQuery);
    if (state.activeProject !== 'all') items = items.filter(project => project.slug === state.activeProject);
    return items;
  }
  function projectCard(project) {
    const className = project.isPersonalLibrary ? ' project-card--library' : '';
    return `<article class="project-card${className}" role="link" tabindex="0" data-open-project="${project.slug}" aria-label="Открыть проект ${escapeHTML(project.title)}">
      <div class="project-art">${artMarkup(project)}<span class="project-folder-badge">${project.isPersonalLibrary ? 'ЛИЧНАЯ БИБЛИОТЕКА' : 'ОТКРЫТЬ ПРОЕКТ'}</span></div>
      <div class="project-card-meta"><div><h3 class="project-card-title">${escapeHTML(project.title)}</h3><p class="project-card-subtitle">${escapeHTML(project.subtitle)}</p></div><span class="card-action" aria-hidden="true">↗</span></div>
    </article>`;
  }
  function renderPortfolio() {
    const grid = $('#portfolio-grid');
    if (!grid) return;
    const items = getVisibleProjects();
    grid.innerHTML = items.length ? items.map(projectCard).join('') : `
      <div class="empty-state"><span class="empty-mark" aria-hidden="true">⌕</span><h3>${state.query || state.activeProject !== 'all' ? 'Ничего не найдено' : 'Проектов пока нет'}</h3>
      <p>Попробуй изменить запрос или сбросить фильтр.</p></div>`;
    const count = $('#results-count');
    if (count) count.textContent = `${String(items.length).padStart(2, '0')} ${items.length === 1 ? 'проект' : 'проектов'}`;
    const foot = $('#archive-foot-count');
    if (foot) foot.textContent = `${String(items.length).padStart(2, '0')} ${items.length === 1 ? 'ПРОЕКТ' : 'ПРОЕКТОВ'}`;
    if (window.__revealObserver) observeReveals();
  }
  function mediaTile(file, project, index) {
    const kind = file.mediaType === 'video' ? 'VIDEO' : 'PHOTO';
    const media = file.mediaType === 'image'
      ? `<img src="${escapeHTML(file.path)}" alt="Фото ${index + 1} — ${escapeHTML(project.title)}" loading="lazy" decoding="async">`
      : `<video class="project-media-video" muted playsinline preload="none" data-video-preview src="${escapeHTML(file.path)}" aria-label="Видео ${index + 1} — ${escapeHTML(project.title)}"></video><span class="video-play-glyph" aria-hidden="true">▶</span>`;
    return `<button class="project-media-tile" type="button" data-project-media="${escapeHTML(file.id)}" aria-label="Открыть ${kind === 'VIDEO' ? 'видео' : 'фото'} ${index + 1}">${media}<span class="media-type-pill">${kind}</span></button>`;
  }
  function renderProjectRoute(slug) {
    const project = getProject(slug);
    if (!project) {
      location.hash = '#work';
      return;
    }
    const target = $('#project-view');
    const files = getProjectFiles(project.slug);
    const currentIndex = projects.findIndex(p => p.slug === project.slug);
    const next = projects[(currentIndex + 1) % projects.length];
    const gallery = files.length
      ? `<div class="project-media-grid">${files.map((file, index) => mediaTile(file, project, index)).join('')}</div>`
      : `<div class="project-empty"><strong>Папка пока пуста</strong><p>Добавь фото или видео в <code>media/${escapeHTML(project.slug)}/</code>. Файлы появятся здесь автоматически после обновления медиаманифеста.</p></div>`;
    target.innerHTML = `
      <a href="#work" class="project-back"><span>←</span> Назад к проектам</a>
      <section class="project-hero"><div><p class="project-kicker">${escapeHTML(project.number)} / ${String(projects.length).padStart(2, '0')} &nbsp;—&nbsp; ${escapeHTML(project.eyebrow)}</p><h1>${escapeHTML(project.title).replace(/Геленджик /, 'Геленджик<br>').replace('Академия ФК ', 'Академия ФК<br>')}<br><em>${escapeHTML(project.heroPhrase || project.subtitle.split(' ').slice(0, 2).join(' '))}</em></h1><p class="project-lead">${escapeHTML(project.detail)}</p><div class="project-specs"><div><span>Моя роль</span><strong>${escapeHTML(project.role)}</strong></div><div><span>Формат</span><strong>${escapeHTML(project.context)}</strong></div></div></div><div class="project-hero-art">${artMarkup(project)}<div class="visual-meta visual-meta--bottom"><span>${project.isPersonalLibrary ? 'АВТОРСКАЯ БИБЛИОТЕКА' : 'ПРОЕКТ / ' + escapeHTML(project.number)}</span><span>${String(files.length).padStart(2, '0')} МАТЕРИАЛОВ</span></div></div></section>
      <section class="project-media-section"><div class="project-media-heading"><div><p class="project-media-kicker">ВНУТРИ ПАПКИ</p><h2>Фото, видео и материалы</h2></div><p>${String(files.length).padStart(2, '0')} / БЕЗ НАЗВАНИЙ ФАЙЛОВ</p></div>${gallery}</section>
      <div class="project-next"><span>СЛЕДУЮЩИЙ ПРОЕКТ</span><a href="#project/${next.slug}">${escapeHTML(next.title)} <span aria-hidden="true">↗</span></a></div>
      <footer class="site-footer project-footer"><a class="brand brand--footer" href="#top" aria-label="Vladimir Gromov — наверх"><span class="brand-word brand-name">Vladimir Gromov</span></a><a href="#work" class="back-top">Все проекты ↑</a></footer>`;
    document.title = `${project.title} — Vladimir Gromov`;
    const desc = $('meta[name="description"]');
    if (desc) desc.content = project.lead;
    target.hidden = false;
    observeReveals();
    // Не запускаем все ролики одновременно в превью: это вызывало рывки,
    // чёрные кадры и конфликтовало с воспроизведением в модальном окне.
    $$('.project-media-video', target).forEach(video => {
      video.pause();
      video.currentTime = 0;
    });
    $('#home-view').hidden = true;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }
  function renderRoute() {
    const match = location.hash.match(/^#project\/([^/?]+)/);
    if (match) {
      renderProjectRoute(decodeURIComponent(match[1]));
    } else {
      $('#project-view').hidden = true;
      $('#home-view').hidden = false;
      document.title = state.config.siteTitle || 'Vladimir Gromov — портфолио';
      const desc = $('meta[name="description"]');
      if (desc) desc.content = 'Авторское портфолио: фотография, видео, digital-контент, визуальные концепции и ландшафтные проекты.';
      // Project anchors must scroll naturally. On back-navigation from a case, return to the archive.
    }
    closeMobileMenu();
  }
  function prefersReducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function openLightbox(items, index) {
    if (!items || !items.length) return;
    state.lightboxItems = items;
    state.lightboxIndex = Math.max(0, Math.min(index, items.length - 1));
    state.priorFocus = document.activeElement;
    const box = $('#lightbox');
    box.hidden = false;
    document.body.style.overflow = 'hidden';
    renderLightboxItem();
    $('#lightbox-close').focus();
  }
  function renderLightboxItem() {
    const item = state.lightboxItems[state.lightboxIndex];
    if (!item) return;
    const stage = $('#lightbox-stage');
    const project = getProject(item.project);
    const kindLabel = item.mediaType === 'video' ? 'Видео' : 'Фото';
    const position = state.lightboxIndex + 1;
    stage.innerHTML = item.mediaType === 'video'
      ? `<video controls autoplay playsinline preload="metadata" src="${escapeHTML(item.path)}">Ваш браузер не поддерживает встроенное видео.</video>`
      : `<img src="${escapeHTML(item.path)}" alt="${escapeHTML(kindLabel)} ${position} — ${escapeHTML(project?.title || 'Проект')}">`;
    $('#lightbox-title').textContent = `${project?.title || 'Проект'} · ${kindLabel} ${position}`;
    $('#lightbox-counter').textContent = `${String(position).padStart(2, '0')} / ${String(state.lightboxItems.length).padStart(2, '0')}`;
    const multiple = state.lightboxItems.length > 1;
    $('#lightbox-prev').hidden = !multiple;
    $('#lightbox-next').hidden = !multiple;
  }
  function closeLightbox() {
    const box = $('#lightbox');
    if (box.hidden) return;
    $('#lightbox-stage').innerHTML = '';
    box.hidden = true;
    document.body.style.overflow = '';
    if (state.priorFocus && typeof state.priorFocus.focus === 'function') state.priorFocus.focus();
  }
  function moveLightbox(direction) {
    const length = state.lightboxItems.length;
    if (length < 2) return;
    state.lightboxIndex = (state.lightboxIndex + direction + length) % length;
    renderLightboxItem();
  }
  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
  }
  function setupContact() {
    const email = String(state.config.email || 'vladimir-gr10@yandex.ru').trim();
    const telegram = String(state.config.telegram || '@Grom_8V').trim().replace(/^@/, '');
    const action = $('#contact-action');
    const label = $('#contact-action-label');
    const hint = $('#contact-hint');
    const telegramUrl = `https://t.me/${encodeURIComponent(telegram)}`;
    if (action) {
      action.href = telegramUrl;
      action.target = '_blank';
      action.rel = 'noopener noreferrer';
    }
    if (label) label.textContent = 'Написать в Telegram';
    if (hint) {
      hint.innerHTML = `<a href="${telegramUrl}" target="_blank" rel="noopener noreferrer"><span>Telegram</span><strong>@${escapeHTML(telegram)}</strong></a><a href="mailto:${escapeHTML(email)}"><span>Email</span><strong>${escapeHTML(email)}</strong></a>`;
    }
    const schema = $('#structured-data');
    if (schema) schema.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Person', name: state.config.authorName || 'Vladimir Gromov', description: state.config.shortBio || '' });
  }
  function setupReveal() {
    const revealSelector = '.section-heading, .section-endline, .filters, .feature-card, .project-card, .practice-row, .about-brief, .about-copy, .contact-layout, .archive-foot, .project-hero, .project-media-section, .project-next';
    $$(revealSelector).forEach(node => {
      if (!node.classList.contains('reveal')) node.classList.add('reveal');
    });
    if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
      $$('.reveal').forEach(node => node.classList.add('is-visible'));
      return;
    }
    if (!window.__revealObserver) window.__revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          window.__revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -3% 0px' });
    $$('.reveal:not(.is-visible)').forEach(node => window.__revealObserver.observe(node));
  }
  function observeReveals() { setupReveal(); }
  function setupScrollEffects() {
    const fill = $('#reading-progress-fill');
    let queued = false;
    const updateProgress = () => {
      queued = false;
      const root = document.documentElement;
      const total = Math.max(1, root.scrollHeight - window.innerHeight);
      const progress = Math.min(100, Math.max(0, (window.scrollY / total) * 100));
      if (fill) fill.style.width = `${progress}%`;
    };
    const requestUpdate = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(updateProgress);
    };
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    updateProgress();

    const navLinks = $$('.main-nav a[href^="#"]');
    const sections = navLinks.map(link => $(link.getAttribute('href'))).filter(Boolean);
    if ('IntersectionObserver' in window && sections.length) {
      const navObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          navLinks.forEach(link => link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`));
        });
      }, { rootMargin: '-28% 0px -60% 0px', threshold: 0 });
      sections.forEach(section => navObserver.observe(section));
    }

    const visual = $('.hero-visual');
    if (visual && window.matchMedia('(hover: hover) and (pointer: fine)').matches && !prefersReducedMotion()) {
      visual.addEventListener('pointermove', event => {
        const bounds = visual.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - .5;
        const y = (event.clientY - bounds.top) / bounds.height - .5;
        visual.style.setProperty('--art-x', `${(-x * 8).toFixed(2)}px`);
        visual.style.setProperty('--art-y', `${(-y * 6).toFixed(2)}px`);
      });
      visual.addEventListener('pointerleave', () => {
        visual.style.setProperty('--art-x', '0px');
        visual.style.setProperty('--art-y', '0px');
      });
    }
  }
  function closeMobileMenu() {
    $('#main-nav')?.classList.remove('is-open');
    $('#menu-toggle')?.classList.remove('is-open');
    $('#menu-toggle')?.setAttribute('aria-expanded', 'false');
  }
  function setupEvents() {
    $('#search-input').addEventListener('input', event => { state.query = event.target.value.trim().toLowerCase(); renderPortfolio(); });
    $('#project-filter').addEventListener('change', event => { state.activeProject = event.target.value; renderPortfolio(); });
    $('#reset-filters').addEventListener('click', () => {
      state.activeProject = 'all'; state.query = '';
      $('#search-input').value = ''; $('#project-filter').value = 'all'; renderPortfolio();
    });
    document.querySelectorAll('a[href="#top"]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }));
    $('#menu-toggle').addEventListener('click', () => {
      const open = !$('#main-nav').classList.contains('is-open');
      $('#main-nav').classList.toggle('is-open', open); $('#menu-toggle').classList.toggle('is-open', open); $('#menu-toggle').setAttribute('aria-expanded', String(open));
    });
    $('#main-nav').addEventListener('click', event => { if (event.target.closest('a')) closeMobileMenu(); });
    document.addEventListener('click', event => {
      const projectLink = event.target.closest('[data-project-link]');
      if (projectLink) { event.stopPropagation(); return; }
      const projectCardEl = event.target.closest('[data-open-project]');
      if (projectCardEl) { location.hash = `project/${encodeURIComponent(projectCardEl.dataset.openProject)}`; return; }
      const projectMediaEl = event.target.closest('[data-project-media]');
      if (projectMediaEl) {
        const files = getProjectFiles(getProjectFromHash());
        const idx = files.findIndex(item => item.id === projectMediaEl.dataset.projectMedia);
        if (idx >= 0) openLightbox(files, idx);
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if (!$('#lightbox').hidden) { closeLightbox(); return; }
        closeMobileMenu();
      }
      if (!$('#lightbox').hidden) {
        if (event.key === 'ArrowRight') moveLightbox(1);
        if (event.key === 'ArrowLeft') moveLightbox(-1);
      }
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-open-project]')) {
        event.preventDefault(); event.target.click();
      }
    });
    $('#lightbox-close').addEventListener('click', closeLightbox);
    $('#lightbox-prev').addEventListener('click', () => moveLightbox(-1));
    $('#lightbox-next').addEventListener('click', () => moveLightbox(1));
    $('#lightbox').addEventListener('click', event => { if (event.target === $('#lightbox')) closeLightbox(); });
    window.addEventListener('hashchange', renderRoute);
  }
  function getProjectFromHash() {
    const match = location.hash.match(/^#project\/([^/?]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }
  async function loadJSON(url, fallback) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return fallback;
      return await response.json();
    } catch (_) { return fallback; }
  }
  async function init() {
    const [manifest, config] = await Promise.all([
      loadJSON('data/media-manifest.json', []),
      loadJSON('data/site-config.json', {})
    ]);
    state.manifest = Array.isArray(manifest) ? manifest : [];
    state.config = config && typeof config === 'object' ? config : {};
    if (state.config.siteTitle) document.title = state.config.siteTitle;
    populateProjectFilter();
    renderFeatured();
    renderPortfolio();
    setupContact();
    setupEvents();
    observeReveals();
    setupScrollEffects();
    if (location.hash.startsWith('#project/')) renderRoute();
  }
  init();
})();
