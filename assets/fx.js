/* AI Bridge deck effects (like the v4 deck):
   1. a living network behind the slides: the REAL Caltech network (assets/net.js), drifting, bridges pulsing
   2. scenes per slide (data-scene): dim | title | faint | data
   3. data slide: click 1 = groups light up, click 2 = a skill spreads from the bridge students (illustration)
   4. numbers count up when a slide appears
   5. progress bar
*/
(function () {
  const NET = window.NET; if (!NET) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = document.getElementById('stage');
  const HOUSE = ['#0A84FF', '#5AC8FA', '#FF9F0A', '#64D2FF', '#BF5AF2', '#30D158', '#7D7AFF', '#FF6482'].map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
  const GREY = [90, 100, 118], INK = [245, 245, 247];
  const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;

  const nodes = NET.n.map(([x, y, h, br, deg], i) => ({ x, y, h, br, deg, ph: i * 2.399 }));
  // ring layout (NodeXL "Circle"): everyone on one ring, sorted by house, a small gap between houses
  {
    const order = nodes.map((n, i) => i).sort((a, b) => nodes[a].h - nodes[b].h || nodes[b].deg - nodes[a].deg);
    const houses = new Set(nodes.map(n => n.h)).size, gap = 6, slots = nodes.length + houses * gap;
    let s = 0, prev = null;
    order.forEach(i => { if (prev !== null && nodes[i].h !== prev) s += gap; prev = nodes[i].h;
      const a = -Math.PI / 2 + 2 * Math.PI * (s++ + gap / 2) / slots; nodes[i].rx = .5 + .47 * Math.cos(a); nodes[i].ry = .5 + .47 * Math.sin(a); });
  }
  const adj = nodes.map(() => []);
  NET.e.forEach(([a, b], k) => { adj[a].push([b, k]); adj[b].push([a, k]); });

  // ---- scenes: region on the 1920x1080 stage + look ----
  const SC = {
    dim:   { x: 160, y: 60, w: 1600, h: 960, a: .16, color: .35, pulse: 0, house: 0, ring: 0 },
    title: { x: 980, y: 40, w: 1000, h: 1000, a: .55, color: .9, pulse: 1, house: 0, ring: 0 },
    faint: { x: 160, y: 60, w: 1600, h: 960, a: .3, color: .8, pulse: 1, house: 0, ring: 0 },
    data:  { x: 140, y: 140, w: 800, h: 800, a: 1, color: 1, pulse: 1, house: 0, ring: 1 },
  };
  const P = Object.assign({}, SC.dim); let T = SC.dim;
  let spread = null;     // {lit:Map(node->time), hot:Map(edge->time)}

  const cv = document.createElement('canvas'); cv.id = 'fx';
  Object.assign(cv.style, { position: 'absolute', inset: '0', width: '1920px', height: '1080px', pointerEvents: 'none', zIndex: 0 });
  stage.prepend(cv);
  const ctx = cv.getContext('2d');
  let k = 1;
  function size() {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    k = Math.min(2, (devicePixelRatio || 1) * s);
    cv.width = Math.round(1920 * k); cv.height = Math.round(1080 * k);
  }
  addEventListener('resize', size); size();

  function place(n, t) {
    const nx = n.x + (n.rx - n.x) * P.ring, ny = n.y + (n.ry - n.y) * P.ring;
    let X = P.x + P.w * nx, Y = P.y + P.h * ny;
    if (!reduce) { X += Math.sin(t / 1700 + n.ph) * 4; Y += Math.cos(t / 1900 + n.ph) * 4; }
    return [X, Y];
  }
  function draw(t) {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, 1920, 1080);
    if (P.a < .005) return;
    const pos = nodes.map(n => place(n, t));
    ctx.lineCap = 'round';
    NET.e.forEach(([a, b], e) => {
      const same = nodes[a].h === nodes[b].h;
      let col = GREY, al = .28, w = 1;
      if (!same) al *= 1 - .55 * P.ring;
      if (P.house > .01) { if (same) { col = HOUSE[nodes[a].h]; al = .28 + .25 * P.house; } else al *= 1 - .6 * P.house; }
      if (spread && spread.hot.has(e)) { const age = Math.min(1, (t - spread.hot.get(e)) / 500); col = INK; al = .25 + .6 * (1 - age * .5); w = 2.2; }
      ctx.globalAlpha = al * P.a; ctx.strokeStyle = mix(col, col, 0); ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(pos[a][0], pos[a][1]); ctx.lineTo(pos[b][0], pos[b][1]); ctx.stroke();
    });
    nodes.forEach((n, i) => {
      const [X, Y] = pos[i];
      let c = P.color, r = n.br ? 8 : 3.5 + Math.min(3.5, Math.sqrt(n.deg) * .35), base = HOUSE[n.h];
      let lit = spread && spread.lit.has(i);
      if (spread && !lit) c *= .25;
      if (n.br && P.pulse > .01 && !reduce) {
        const q = (t / 1700 + n.ph / 6) % 1;
        ctx.globalAlpha = (1 - q) * .5 * P.pulse * P.a; ctx.strokeStyle = mix(base, base, 0); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X, Y, r + 4 + q * 26, 0, 7); ctx.stroke();
      }
      if (lit) { const age = Math.min(1, (t - spread.lit.get(i)) / 400); r *= 1 + .6 * (1 - age); }
      ctx.globalAlpha = P.a; ctx.fillStyle = mix(GREY, base, c);
      ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
      if ((n.br && P.color > .6) || lit) { ctx.lineWidth = n.br ? 2.6 : 1.4; ctx.strokeStyle = 'rgb(245,245,247)'; ctx.stroke(); }
    });
    ctx.globalAlpha = 1;
  }
  function loop(t) {
    for (const key in T) { const d = T[key] - P[key]; P[key] = Math.abs(d) < 1e-3 ? T[key] : P[key] + d * (reduce ? 1 : .07); }
    draw(t); requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---- the spread: starts at the bridge students of one house, one wave every 0.5 s ----
  function runSpread() {
    const counts = {}; nodes.forEach(n => counts[n.h] = (counts[n.h] || 0) + 1);
    const h0 = +Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const seeds = nodes.map((n, i) => i).filter(i => nodes[i].br && nodes[i].h === h0);
    let rnd = 7; const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
    const now = performance.now();
    spread = { lit: new Map(seeds.map(s => [s, now])), hot: new Map() };
    let wave = seeds, step = 0;
    const tick = () => {
      if (!spread || step++ > 6 || !wave.length) return;
      const t = performance.now(), nxt = [];
      for (const v of wave) for (const [u, e] of adj[v]) if (!spread.lit.has(u) && rand() < .11) { spread.lit.set(u, t); spread.hot.set(e, t); nxt.push(u); }
      wave = nxt; setTimeout(tick, 520);
    };
    setTimeout(tick, 450);
  }

  // ---- count-up numbers ----
  function countUp(el) {
    if (el.dataset.fxDone === '1' && el.dataset.fxText) el.textContent = el.dataset.fxText;
    const txt = el.dataset.fxText || el.textContent; el.dataset.fxText = txt; el.dataset.fxDone = '1';
    const m = txt.match(/^([^\d]*)([\d][\d,]*\.?\d*)(.*)$/s); if (!m || reduce) return;
    const [, pre, num, post] = m, to = parseFloat(num.replace(/,/g, '')), dec = (num.split('.')[1] || '').length, comma = num.includes(',');
    const fmt = v => pre + (comma ? v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec)) + post;
    const t0 = performance.now() + 350, dur = 1300;
    el.textContent = fmt(0);
    const stepf = now => { const q = Math.max(0, Math.min(1, (now - t0) / dur)); el.textContent = fmt(to * (1 - Math.pow(1 - q, 3))); if (q < 1) requestAnimationFrame(stepf); else el.textContent = txt; };
    requestAnimationFrame(stepf);
  }

  // ---- progress bar ----
  const bar = document.createElement('div'); bar.id = 'prog';
  Object.assign(bar.style, { position: 'fixed', left: 0, bottom: 0, height: '4px', width: '0', zIndex: 8, transition: 'width .8s cubic-bezier(.22,.8,.24,1)', background: 'linear-gradient(90deg,#0A84FF,#5AC8FA)' });
  document.body.appendChild(bar);

  document.documentElement.classList.add('fx-on');
  window.FX = {
    enter(slide, n, total, stepsOn) {
      T = SC[slide.dataset.scene] || SC.dim;
      spread = null; T = Object.assign({}, T);
      this.step(slide, stepsOn || 0);
      slide.querySelectorAll('[data-count]').forEach(countUp);
      bar.style.width = (n <= 0 ? 0 : Math.min(1, n / total) * 100) + '%';
      bar.style.opacity = n > total ? 0 : 1;
    },
    step(slide, on) {
      if (slide.dataset.scene !== 'data') return;
      T = Object.assign({}, SC.data, { house: on >= 1 ? 1 : 0 });
      if (on >= 2) { if (!spread) runSpread(); } else spread = null;
    },
  };
})();
