(() => {
  'use strict';
  const items = window.RR_COLLECTION;
  const planned = window.RR_PLANNED;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escape = (text) => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2, '0');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dialog = $('#object-dialog');
  const model = $('#model-viewer');
  const video = $('#viewer-video');
  let selected = null;
  let activeView = 'image';
  let modelLibrary;
  let openTrigger;
  let shareTimer;

  function announce(text) { $('#announcer').textContent = text; }

  function renderGrid(category = 'all') {
    const visible = items.filter(item => category === 'all' || item.category === category);
    $('#object-grid').innerHTML = visible.length ? visible.map(item => `
      <article class="object-card">
        <button class="card-stage ${escape(item.tone)}" type="button" data-open="${escape(item.id)}" aria-label="Explore ${escape(item.title)}">
          <img src="${escape(item.cover)}" alt="${escape(item.title)} reconstructed in 3D, with its captured surroundings" width="1440" height="1080" loading="lazy" decoding="async">
          <span class="card-index mono">RR—${escape(item.number)}</span><span class="card-category">${escape(item.category)}</span>
          <span class="card-explore">Explore object ${icon('arrow')}</span>
        </button>
        <div class="card-bottom"><a href="#object=${encodeURIComponent(item.id)}&view=image"><h3>${escape(item.title)}</h3></a><div class="card-tools"><button class="card-tool" type="button" data-open="${escape(item.id)}" data-mode="model" aria-label="Try ${escape(item.title)} wireframe">${icon('cube')}</button><button class="card-tool" type="button" data-open="${escape(item.id)}" data-mode="film" aria-label="Watch ${escape(item.title)} rendered video">${icon('play')}</button></div></div>
        <span class="card-kind">${escape(item.category)} / Reconstruction</span>
      </article>`).join('') : `<article class="empty-collection"><div><span class="eyebrow">Bags / Upcoming pilot</span><h3>Bags are next.</h3><p>Bag scanning pilots are planned. Our first bag scans will appear here.</p><a class="text-link" href="#planned-bags">View planned studies ${icon('arrow')}</a></div><svg class="empty-bag" viewBox="0 0 96 96" aria-hidden="true">${planned.find(item => item.category === 'Bags').drawing}</svg></article>`;
    $('.collection-total').textContent = `[ ${String(visible.length).padStart(3, '0')} objects ]`;
  }

  $('.filters').innerHTML = ['all', ...new Set([...(window.RR_CATEGORIES || []), ...items.map(item => item.category)])].map(category => {
    const count = category === 'all' ? items.length : items.filter(item => item.category === category).length;
    return `<button class="filter ${category === 'all' ? 'active' : ''}" data-filter="${escape(category)}" aria-pressed="${category === 'all'}">${category === 'all' ? 'All objects' : escape(category)} <sup>${pad(count)}</sup></button>`;
  }).join('');
  $('#future-grid').innerHTML = planned.map((item, i) => `<article ${item.category === 'Bags' ? 'id="planned-bags"' : ''} class="future-card ${i === planned.length - 1 ? 'invitation' : ''}"><div class="future-top mono"><span>${item.number}</span><span>PLANNED</span></div><svg viewBox="0 0 96 96" aria-hidden="true">${item.drawing}</svg><h3>${escape(item.name)}</h3><p>${escape(item.category)}</p>${i === planned.length - 1 ? '<a href="mailto:info@roboticrays.com" aria-label="Discuss scanning your object"></a>' : ''}</article>`).join('');
  $('.archive-strip>.mono').textContent = `${pad(items.length)} scans  /  ${pad(planned.length)} on the horizon`;
  $('#year').textContent = new Date().getFullYear();
  renderGrid();

  $('.filters').addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    $$('.filter').forEach(filter => {
      const active = filter === button;
      filter.classList.toggle('active', active);
      filter.setAttribute('aria-pressed', active);
    });
    renderGrid(button.dataset.filter);
    announce(`Showing ${button.dataset.filter === 'all' ? 'all objects' : button.dataset.filter + ' objects'}`);
  });

  // The library is local, and loads only when the visitor requests 3D.
  function loadModelLibrary() {
    if (!modelLibrary) {
      modelLibrary = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'assets/vendor/model-viewer.min.js';
        script.onload = () => customElements.whenDefined('model-viewer').then(resolve);
        script.onerror = () => { script.remove(); modelLibrary = null; reject(new Error('Viewer library could not load')); };
        document.head.append(script);
      });
    }
    return modelLibrary;
  }

  function setImage() {
    $('#viewer-image').src = selected.photo;
    $('#viewer-image').alt = `Photograph of the physical ${selected.title.toLowerCase()}`;
    $('#panel-image').classList.add('reference-view');
    $('#image-label').textContent = 'Physical object / Photograph';
    $('#viewer-format').textContent = 'PHOTOGRAPH';
  }

  function setRotation(rotate) {
    model.toggleAttribute('auto-rotate', rotate);
    $('#rotate-model').setAttribute('aria-pressed', rotate);
    $('#rotate-model span').textContent = rotate ? 'Pause rotation' : 'Auto rotate';
  }

  function setView(view) {
    const token = selected;
    if (!['image', 'model', 'film'].includes(view)) view = 'image';
    activeView = view;
    video.pause();
    setRotation(false);
    $$('.viewer-tab').forEach(tab => {
      const active = tab.dataset.view === view;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active);
      tab.tabIndex = active ? 0 : -1;
      $(`#panel-${tab.dataset.view}`).hidden = !active;
    });
    if (view === 'image') {
      setImage();
      $('#viewer-hint').textContent = 'The physical object, photographed.';
      $('#viewer-context').textContent = 'An original photograph of the physical object from the capture session.';
    } else if (view === 'film') {
      $('#viewer-hint').textContent = 'A rendered view of the reconstructed 3D object.';
      $('#viewer-format').textContent = '4K / 14 SEC';
      $('#viewer-context').textContent = 'This video is rendered from the reconstructed 3D model. It is not footage of the physical object. A capture reference appears in the upper corner.';
      video.preload = 'metadata';
      if (video.getAttribute('src') !== selected.video || video.error) {
        $('#film-error').hidden = true;
        video.src = selected.video;
      }
      video.poster = selected.full;
    } else {
      $('#viewer-hint').textContent = 'Drag to rotate · Scroll or pinch to zoom';
      $('#viewer-format').textContent = 'WIREFRAME';
      $('#viewer-context').textContent = selected.modelNote || 'A simplified wireframe derived from the scanned object. Rotate to explore its shape.';
      $('.demo-badge').hidden = false;
      $('#model-error').hidden = true;
      loadModelLibrary().then(() => {
        if (selected !== token || !dialog.open || activeView !== 'model') return;
        if (model.getAttribute('src') !== selected.model) {
          model.setAttribute('src', selected.model);
          model.setAttribute('camera-orbit', '30deg 55deg auto');
          model.setAttribute('field-of-view', '30deg');
        }
        model.setAttribute('alt', `Scan-derived wireframe of ${selected.title}. Drag to rotate and pinch or scroll to zoom.`);
      }).catch(() => { if (selected === token) $('#model-error').hidden = false; });
    }
  }

  function openObject(id, view = 'image') {
    const item = items.find(item => item.id === id);
    if (!item) return;
    const changed = selected !== item;
    if (!dialog.open) {
      openTrigger = document.activeElement;
      dialog.showModal();
      document.body.classList.add('viewer-open');
    }
    selected = item;
    if (changed) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      $('#film-error').hidden = true;
      $('#model-error').hidden = true;
      $('#viewer-title').textContent = item.title;
      $('#viewer-id').textContent = `RR—${item.number} / ${item.category}`;
      $('#viewer-description').textContent = item.description;
      $('#detail-tags').innerHTML = item.tags.map(tag => `<span>${escape(tag)}</span>`).join('');
      $('#viewer-position').textContent = `${pad(items.indexOf(item) + 1)} / ${pad(items.length)}`;
      $('#share-object span').textContent = 'Copy object link';
    }
    setView(view);
    if (changed) dialog.scrollTop = 0;
    announce(`${item.title}, ${view === 'model' ? '3D wireframe' : view === 'film' ? 'rendered video' : 'photograph'} view`);
  }

  function navigate(id, view = 'image', replace = false) {
    const hash = `#object=${encodeURIComponent(id)}&view=${view}`;
    if (location.hash !== hash) history[replace ? 'replaceState' : 'pushState']({rrObject: true}, '', hash);
    openObject(id, view);
  }

  function closeViewer(clearHash = true) {
    video.pause();
    setRotation(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (dialog.open) dialog.close();
    document.body.classList.remove('viewer-open');
    if (clearHash && location.hash.startsWith('#object=')) history.replaceState(null, '', location.pathname + location.search + '#collection');
    if (openTrigger?.isConnected) openTrigger.focus({preventScroll:true});
  }

  function readLocation() {
    const parameters = new URLSearchParams(location.hash.slice(1));
    const id = parameters.get('object');
    if (id && items.some(item => item.id === id)) openObject(id, parameters.get('view') || 'image');
    else if (dialog.open) closeViewer(false);
  }

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-open]');
    if (trigger) { event.preventDefault(); navigate(trigger.dataset.open, trigger.dataset.mode || 'image'); }
  });
  $('#close-viewer').addEventListener('click', () => closeViewer());
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeViewer(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeViewer(); } });
  $('#prev-object').addEventListener('click', () => navigate(items[(items.indexOf(selected) - 1 + items.length) % items.length].id, activeView, true));
  $('#next-object').addEventListener('click', () => navigate(items[(items.indexOf(selected) + 1) % items.length].id, activeView, true));
  $$('.viewer-tab').forEach(tab => {
    tab.addEventListener('click', () => navigate(selected.id, tab.dataset.view, true));
    tab.addEventListener('keydown', event => {
      const tabs = $$('.viewer-tab');
      let target;
      if (event.key === 'ArrowRight') target = tabs[(tabs.indexOf(tab) + 1) % tabs.length];
      if (event.key === 'ArrowLeft') target = tabs[(tabs.indexOf(tab) - 1 + tabs.length) % tabs.length];
      if (event.key === 'Home') target = tabs[0];
      if (event.key === 'End') target = tabs.at(-1);
      if (target) { event.preventDefault(); target.focus(); navigate(selected.id, target.dataset.view, true); }
    });
  });
  $('#rotate-model').addEventListener('click', () => setRotation(!model.hasAttribute('auto-rotate')));
  $('#reset-model').addEventListener('click', () => {
    setRotation(false);
    model.setAttribute('camera-orbit', '30deg 55deg auto');
    model.setAttribute('field-of-view', '30deg');
    if (reducedMotion.matches && model.jumpCameraToGoal) model.jumpCameraToGoal();
    announce('3D view reset');
  });
  model.addEventListener('error', () => { $('#model-error').hidden = false; });
  model.addEventListener('load', () => { $('#model-error').hidden = true; });
  video.addEventListener('error', () => { if (video.getAttribute('src')) $('#film-error').hidden = false; });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) setRotation(false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { video.pause(); setRotation(false); } });
  $('#expand-stage').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if ($('#viewer-stage').requestFullscreen) await $('#viewer-stage').requestFullscreen();
      else if (activeView === 'film' && video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      else announce('Fullscreen is not available on this browser.');
    } catch { announce('Fullscreen is not available on this browser.'); }
  });
  document.addEventListener('fullscreenchange', () => $('#expand-stage').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'));
  $('#share-object').addEventListener('click', async () => {
    const url = new URL(location.href);
    url.hash = `object=${encodeURIComponent(selected.id)}&view=${activeView}`;
    try {
      await navigator.clipboard.writeText(url.href);
      $('#share-object span').textContent = 'Link copied';
      announce('Object link copied');
      clearTimeout(shareTimer);
      shareTimer = setTimeout(() => { $('#share-object span').textContent = 'Copy object link'; }, 2500);
    } catch {
      $('#share-object span').textContent = 'Copy the address from your browser';
      announce('Copy the object link from the browser address bar.');
    }
  });
  window.addEventListener('hashchange', readLocation);
  window.addEventListener('popstate', readLocation);
  readLocation();
})();
