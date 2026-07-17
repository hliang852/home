/* =====================================================================
   TAGCLOUD.JS — floating "field" bubbles for projects.html
   ---------------------------------------------------------------------
   Zero maintenance: it reads each project's .kind label (the left
   column) and turns it into topic bubbles. A kind joined by "x" counts
   as membership in BOTH fields, so "AI x Philosophy" puts that project
   in the AI bubble AND the Philosophy bubble.
     - color = the field itself (auto-assigned from the site palette)
     - size / fill = how many projects share that field (more = larger,
       and 2+ projects gets a solid fill instead of a tint)
     - drag  = toss a bubble around
     - pinch = two fingers anywhere in the box scale the whole cloud
     - click = smooth-scroll to the first project in that field
   To make a theme cluster and grow, reuse the same word across kinds,
   e.g. "Finance x AI", "AI x Philosophy", "AI x Economy".
   ===================================================================== */
(function(){
  const arena = document.getElementById('tagcloud');
  const tip = document.getElementById('tc-tip');
  if(!arena) return;

  // palette: muted tones chosen to sit with the paper/ink page.
  // fields are colored by order of first appearance, so a given field
  // keeps its color as long as the project order is stable.
  const PALETTE = ['#4B5A45','#7A2E1F','#8F6E1F','#46586A','#5B6E63',
                   '#85552F','#6B6051'];

  // ---- 1. read .kind labels, splitting on a standalone "x" / "×" ----
  const fields = new Map();  // key -> {name, count, first, color}
  const projects = document.querySelectorAll('.proj-entry');
  let colorIdx = 0;
  projects.forEach(entry => {
    const kindEl = entry.querySelector('.kind');
    if(!kindEl) return;
    kindEl.textContent.split(/\s+[x×]\s+/i).forEach(part => {
      const name = part.trim();
      if(!name) return;
      const key = name.toLowerCase();
      if(!fields.has(key)){
        fields.set(key, {name, count:0, first:entry,
                         color: PALETTE[colorIdx++ % PALETTE.length]});
      }
      fields.get(key).count++;
    });
  });
  if(fields.size === 0) return;

  const jumpTo = el => {
    el.scrollIntoView({behavior:'smooth', block:'start'});
    el.classList.remove('flash');
    void el.offsetWidth;               // restart animation
    el.classList.add('flash');
  };

  // ---- 2. build the bubbles ----
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bubbles = [];
  let scale = arena.clientWidth < 520 ? 0.78 : 1;   // pinch scale (whole cloud)

  fields.forEach(f => {
    const hot = f.count > 1;                          // shared by 2+ projects

    // diameter: room for the label, plus a boost per extra project
    const base = Math.min(120, Math.max(62, 38 + f.name.length * 2.4));
    const d = Math.round(base * (1 + 0.28 * Math.min(f.count - 1, 2)));

    const el = document.createElement('div');
    el.className = 'tc-bubble' + (hot ? ' hot' : '');
    el.textContent = f.name;
    el.style.width = el.style.height = d + 'px';
    if(hot){
      el.style.background = f.color;
      el.style.color = 'var(--paper)';
      el.style.borderColor = f.color;
    } else {
      el.style.color = f.color;
      el.style.background = 'color-mix(in srgb, ' + f.color + ' 12%, var(--paper))';
      el.style.borderColor = 'color-mix(in srgb, ' + f.color + ' 60%, var(--paper))';
    }

    const tipText = f.count + (f.count === 1 ? ' project' : ' projects') +
      ' — click to jump';
    el.setAttribute('role','button');
    el.tabIndex = 0;
    el.setAttribute('aria-label', f.name + ', ' + tipText);
    el.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); jumpTo(f.first); }
    });
    if(tip){
      el.addEventListener('mousemove', e => {
        if(b.dragId !== null){ tip.style.display = 'none'; return; }
        tip.textContent = tipText;
        tip.style.display = 'block';
        tip.style.left = e.clientX + 'px';
        tip.style.top = e.clientY + 'px';
      });
      el.addEventListener('mouseleave', () => tip.style.display = 'none');
    }
    arena.appendChild(el);

    const r = d / 2;
    const b = {
      el, r,
      x: r + Math.random() * Math.max(1, arena.clientWidth  - d),
      y: r + Math.random() * Math.max(1, arena.clientHeight - d),
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      dragId: null, dragMoved: 0, lastX: 0, lastY: 0,
    };
    bubbles.push(b);

    // drag to toss; a near-still press counts as a click
    el.addEventListener('pointerdown', e => {
      if(pinch || pointers.size >= 2) return;
      if(e.pointerType === 'mouse' && e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      b.dragId = e.pointerId; b.dragMoved = 0;
      b.lastX = e.clientX; b.lastY = e.clientY;
      e.preventDefault();
    });
    el.addEventListener('pointermove', e => {
      if(b.dragId !== e.pointerId) return;
      const dx = e.clientX - b.lastX, dy = e.clientY - b.lastY;
      b.lastX = e.clientX; b.lastY = e.clientY;
      b.x += dx; b.y += dy;
      b.vx = dx * 0.4; b.vy = dy * 0.4;             // release = gentle throw
      b.dragMoved += Math.abs(dx) + Math.abs(dy);
    });
    el.addEventListener('pointerup', e => {
      if(b.dragId !== e.pointerId) return;
      b.dragId = null;
      if(b.dragMoved < 6) jumpTo(f.first);
    });
    el.addEventListener('pointercancel', e => {
      if(b.dragId === e.pointerId) b.dragId = null;
    });
  });

  // ---- 3. pinch: two fingers anywhere in the box scale the cloud ----
  const pointers = new Map();
  let pinch = null;
  arena.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if(pointers.size === 2){
      const [a, c] = [...pointers.values()];
      pinch = {d0: Math.hypot(a.x - c.x, a.y - c.y) || 1, s0: scale};
      bubbles.forEach(b => b.dragId = null);        // pinch cancels any drag
    }
  });
  window.addEventListener('pointermove', e => {
    if(!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if(pinch && pointers.size === 2){
      const [a, c] = [...pointers.values()];
      const d = Math.hypot(a.x - c.x, a.y - c.y);
      scale = Math.min(1.5, Math.max(0.55, pinch.s0 * d / pinch.d0));
    }
  });
  const lift = e => {
    pointers.delete(e.pointerId);
    if(pointers.size < 2) pinch = null;
  };
  window.addEventListener('pointerup', lift);
  window.addEventListener('pointercancel', lift);

  // ---- 4. physics loop: slow drift, wall bounce, soft separation ----
  function step(){
    const w = arena.clientWidth, h = arena.clientHeight;
    for(const b of bubbles){
      if(b.dragId === null){
        if(!reduced){                               // ambient drift
          b.vx += (Math.random() - 0.5) * 0.03;
          b.vy += (Math.random() - 0.5) * 0.03;
        }
        b.vx *= 0.99; b.vy *= 0.99;
        const sp = Math.hypot(b.vx, b.vy);
        if(sp > 0.5){ b.vx = b.vx / sp * 0.5; b.vy = b.vy / sp * 0.5; }
        b.x += b.vx; b.y += b.vy;
      }
      const r = b.r * scale;                        // keep inside the walls
      if(b.x < r){ b.x = r; b.vx = Math.abs(b.vx) * 0.7; }
      if(b.x > w - r){ b.x = w - r; b.vx = -Math.abs(b.vx) * 0.7; }
      if(b.y < r){ b.y = r; b.vy = Math.abs(b.vy) * 0.7; }
      if(b.y > h - r){ b.y = h - r; b.vy = -Math.abs(b.vy) * 0.7; }
    }
    for(let i = 0; i < bubbles.length; i++){        // soft bubble-bubble push
      for(let j = i + 1; j < bubbles.length; j++){
        const a = bubbles[i], c = bubbles[j];
        const dx = c.x - a.x, dy = c.y - a.y;
        const min = (a.r + c.r) * scale + 2;
        const dist = Math.hypot(dx, dy) || 0.001;
        if(dist < min){
          const push = (min - dist) / 2;
          const nx = dx / dist, ny = dy / dist;
          if(a.dragId === null){ a.x -= nx * push; a.y -= ny * push; a.vx -= nx * 0.06; a.vy -= ny * 0.06; }
          if(c.dragId === null){ c.x += nx * push; c.y += ny * push; c.vx += nx * 0.06; c.vy += ny * 0.06; }
        }
      }
    }
    for(const b of bubbles){
      b.el.style.transform =
        'translate(' + (b.x - b.r) + 'px,' + (b.y - b.r) + 'px) scale(' + scale + ')';
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  // ---- 5. caption ----
  const cap = document.getElementById('tc-caption');
  if(cap) cap.textContent =
    fields.size + ' fields across ' + projects.length + ' projects';
})();
