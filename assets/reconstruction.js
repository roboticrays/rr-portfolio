(() => {
  'use strict';
  const stage = document.querySelector('#reconstruction-stage');
  const canvas = document.querySelector('#reconstruction-canvas');
  const toggle = document.querySelector('#reconstruction-toggle');
  if (!stage || !canvas || !toggle) return;
  const context = canvas.getContext('2d');
  if (!context) { stage.setAttribute('aria-busy', 'false'); toggle.hidden = true; return; }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dialog = document.querySelector('#object-dialog');
  let running = !reduced.matches;
  let staticFrame = reduced.matches;
  let visible = true;
  let geometry;
  let frame = 0;
  let lastTime = 0;
  let elapsed = 3400;
  let orbit;
  const images = [];
  const rgbCanvas = document.createElement('canvas');
  rgbCanvas.width = 960; rgbCanvas.height = 720;
  const rgbContext = rgbCanvas.getContext('2d');
  let width = 1;
  let height = 1;
  let projected;

  function readWireframe(buffer) {
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x46546c67) throw new Error('Invalid wireframe');
    const length = view.getUint32(12, true);
    const doc = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length)));
    const start = 28 + length;
    const primitive = doc.meshes[0].primitives[0];
    if (primitive.mode !== 1) throw new Error('Line geometry required');
    const position = doc.accessors[primitive.attributes.POSITION];
    const indices = doc.accessors[primitive.indices];
    const positionsView = doc.bufferViews[position.bufferView];
    const indicesView = doc.bufferViews[indices.bufferView];
    const points = new Float32Array(buffer, start + (positionsView.byteOffset || 0) + (position.byteOffset || 0), position.count * 3);
    const IndexType = indices.componentType === 5123 ? Uint16Array : Uint32Array;
    const edges = new IndexType(buffer, start + (indicesView.byteOffset || 0) + (indices.byteOffset || 0), indices.count);
    const center = position.min.map((value, i) => (value + position.max[i]) / 2);
    return { points, edges, center, count: position.count };
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (geometry) draw();
  }

  function draw() {
    if (!geometry || width < 1 || height < 1) return;
    const { points, edges, center, count } = geometry;
    const cycle = (elapsed % 11000) / 11000;
    const progress = staticFrame ? .52 : Math.min(1, Math.max(0, (cycle - .10) / .66));
    const reset = !staticFrame && cycle > .90 ? (cycle - .90) / .10 : 0;
    const desiredYaw = -.28 + (staticFrame ? 0 : Math.sin(elapsed / 14500) * .34);
    const orbitPosition = Math.max(0, Math.min(orbit.frames - 1, (desiredYaw - orbit.yawMin) / (orbit.yawMax - orbit.yawMin) * (orbit.frames - 1)));
    const desiredIndex = Math.round(orbitPosition);
    let imageIndex = Math.max(0, Math.min(orbit.frames - 1, desiredIndex));
    if (!images[imageIndex]) {
      imageIndex = images.reduce((best, value, i) => value && Math.abs(i - desiredIndex) < Math.abs(best - desiredIndex) ? i : best, images.findIndex(Boolean));
    }
    if (imageIndex < 0) return;
    let rgbView = images[imageIndex];
    let yaw = orbit.yawMin + imageIndex / (orbit.frames - 1) * (orbit.yawMax - orbit.yawMin);
    const lower = Math.floor(orbitPosition), upper = Math.ceil(orbitPosition);
    if (rgbContext && images[lower] && images[upper]) {
      // Blend adjacent RGB views for continuous, very slow camera movement.
      const blend = orbitPosition - lower;
      rgbContext.clearRect(0, 0, 960, 720);
      rgbContext.globalCompositeOperation = 'source-over';
      rgbContext.globalAlpha = 1 - blend;
      rgbContext.drawImage(images[lower], 0, 0);
      rgbContext.globalCompositeOperation = 'lighter';
      rgbContext.globalAlpha = blend;
      rgbContext.drawImage(images[upper], 0, 0);
      rgbContext.globalAlpha = 1;
      rgbContext.globalCompositeOperation = 'source-over';
      rgbView = rgbCanvas;
      yaw = desiredYaw;
    }
    const pitch = .30;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < count; i++) {
      const x = points[i * 3] - center[0], y = points[i * 3 + 1] - center[1], z = points[i * 3 + 2] - center[2];
      const rx = x * cy + z * sy, rz = -x * sy + z * cy;
      const ry = y * cp - rz * sp;
      const perspective = 6 / (6 - (y * sp + rz * cp));
      const px = rx * perspective, py = -ry * perspective;
      projected[i * 2] = px; projected[i * 2 + 1] = py;
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
    const scale = Math.min(960 * .80 / (maxX - minX), 720 * .64 / (maxY - minY));
    const offsetX = 480 - (minX + maxX) / 2 * scale;
    const offsetY = 720 * .51 - (minY + maxY) / 2 * scale;
    for (let i = 0; i < count; i++) {
      projected[i * 2] = projected[i * 2] * scale + offsetX;
      projected[i * 2 + 1] = projected[i * 2 + 1] * scale + offsetY;
    }
    minX = minX * scale + offsetX; maxX = maxX * scale + offsetX;
    const scanX = minX - 18 + progress * (maxX - minX + 36);
    context.clearRect(0, 0, width, height);
    const fit = Math.min(width / 960, height / 720);
    context.save();
    context.translate((width - 960 * fit) / 2, (height - 720 * fit) / 2);
    context.scale(fit, fit);

    // A captured RGB render remains ahead of the scanning plane.
    context.save();
    context.beginPath(); context.rect(scanX, 0, 960 - scanX, 720); context.clip();
    context.drawImage(rgbView, 0, 0, 960, 720);
    context.restore();
    context.globalAlpha = 1 - reset;

    // Reveal each line precisely at the moving scan plane, left to right.
    context.beginPath();
    for (let j = 0; j < edges.length; j += 2) {
      const a = edges[j] * 2, b = edges[j + 1] * 2;
      let ax = projected[a], ay = projected[a + 1], bx = projected[b], by = projected[b + 1];
      if (ax > scanX && bx > scanX) continue;
      if (ax > scanX) { const t = (scanX - bx) / (ax - bx); ay = by + (ay - by) * t; ax = scanX; }
      if (bx > scanX) { const t = (scanX - ax) / (bx - ax); by = ay + (by - ay) * t; bx = scanX; }
      context.moveTo(ax, ay); context.lineTo(bx, by);
    }
    context.lineWidth = .85;
    context.strokeStyle = 'rgba(139, 232, 207, .65)';
    context.stroke();

    if (reset > 0) {
      context.globalAlpha = reset;
      context.drawImage(rgbView, 0, 0, 960, 720);
    }
    context.globalAlpha = 1;
    if (!staticFrame && progress > 0 && progress < 1) {
      const glow = context.createLinearGradient(scanX - 30, 0, scanX + 20, 0);
      glow.addColorStop(0, 'rgba(99, 234, 198, 0)');
      glow.addColorStop(.6, 'rgba(99, 234, 198, .10)');
      glow.addColorStop(1, 'rgba(99, 234, 198, 0)');
      context.fillStyle = glow;
      context.fillRect(scanX - 30, 720 * .12, 50, 720 * .76);
      context.strokeStyle = 'rgba(157, 255, 222, .8)';
      context.lineWidth = 1;
      context.beginPath(); context.moveTo(scanX, 720 * .16); context.lineTo(scanX, 720 * .84); context.stroke();
      context.fillStyle = '#b3f7da';
      context.fillRect(scanX - 3, 720 * .16 - 1, 6, 2);
      context.fillRect(scanX - 3, 720 * .84 - 1, 6, 2);
    }
    context.globalAlpha = 1;
    context.restore();
  }

  function tick(time) {
    frame = 0;
    if (!shouldAnimate()) return;
    if (!lastTime) lastTime = time;
    if (time - lastTime >= 32) {
      elapsed += Math.min(80, time - lastTime);
      lastTime = time;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function shouldAnimate() { return geometry && running && visible && !document.hidden && !dialog?.open; }
  function sync() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; lastTime = 0;
    if (shouldAnimate()) frame = requestAnimationFrame(tick);
  }
  function updateToggle() {
    toggle.setAttribute('aria-label', running ? 'Pause reconstruction animation' : 'Play reconstruction animation');
    toggle.setAttribute('aria-pressed', String(!running));
    toggle.querySelector('.motion-symbol').textContent = running ? 'Ⅱ' : '▶';
    toggle.querySelector('.motion-label').textContent = running ? 'Pause' : 'Play';
  }
  toggle.addEventListener('click', () => { staticFrame = false; running = !running; updateToggle(); draw(); sync(); });
  reduced.addEventListener('change', () => { staticFrame = reduced.matches; running = !reduced.matches; updateToggle(); draw(); sync(); });
  document.addEventListener('visibilitychange', sync);
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }).observe(stage);
  if (dialog) new MutationObserver(sync).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  updateToggle();
  function loadFrame(index) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { images[index] = img; resolve(); };
      img.onerror = reject;
      img.src = `media/images/shoe-orbit/${orbit.files[index]}?v=${encodeURIComponent(orbit.revision || '1')}`;
    });
  }
  Promise.all([
    fetch(canvas.dataset.model).then(response => {
      if (!response.ok) throw new Error('Wireframe unavailable');
      return response.arrayBuffer();
    }),
    fetch('media/images/shoe-orbit/orbit.json').then(response => {
      if (!response.ok) throw new Error('RGB frames unavailable');
      return response.json();
    })
  ]).then(async ([buffer, manifest]) => {
    geometry = readWireframe(buffer);
    orbit = manifest;
    projected = new Float32Array(geometry.count * 2);
    await loadFrame(20);
    resize(); draw();
    stage.querySelector('.reconstruction-poster').alt = '';
    stage.classList.add('is-ready');
    stage.setAttribute('aria-busy', 'false');
    toggle.disabled = false;
    sync();
    // The first RGB view is ready immediately; remaining orbit views load behind it.
    for (let index = 0; index < orbit.frames; index++) {
      if (index !== 20) loadFrame(index).then(() => { if (!running) draw(); }).catch(() => {});
    }
  }).catch(() => {
    stage.setAttribute('aria-busy', 'false');
    toggle.hidden = true;
    // The matching RGB poster remains available without canvas or fetch.
  });
})();
