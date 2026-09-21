/* =====================================================================
   MAP.JS — the maps on map.html
   ---------------------------------------------------------------------
   One engine, used twice:
     1. the world map      pins = cities visited        (world-data.js)
     2. the US parks map   pins = national parks        (us-data.js)

   Each map reads its own hidden <ul> in map.html — one <li> per place,
   with the position in data-lat / data-lon — and draws a pin for it.
   # EDIT PLACES: you never touch this file, only the lists in map.html.

   HOW THE ZOOM TIERS WORK — the map shows more the closer you get, and
   the tiers are measured in real ground distance (how many km the map
   spans from edge to edge), not in zoom steps, so a tier means the same
   thing whatever the screen size or the latitude. Each map sets its own
   thresholds in its config at the bottom of this file; the look of each
   tier is CSS (see "travel map" in style.css):

     z1   too far out for names
     z2   the region names (countries / state codes)
     z3   the names of the places flagged "major"
     z4   every place name
     z5   the date under the name

   "Major" means labelled early: on the world map that is the capitals and
   world cities (data-major), on the parks map it is the parks you have
   actually been to (data-been) — which are also the red ones.
   ===================================================================== */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var a in attrs) n.setAttribute(a, attrs[a]);
    return n;
  }

  function id(x) { return document.getElementById(x); }

  /* ===================================================================
     THE ENGINE
     =================================================================== */
  function createMap(cfg) {
    var stage = id(cfg.stage), svg = id(cfg.svg), list = id(cfg.list);
    var hint = id(cfg.hint), caption = id(cfg.caption), scaleBar = id(cfg.scale);
    if (!stage || !svg || !list) return;

    var VIEW = cfg.view;                       // the slice of the grid we draw
    var EDGE = cfg.edge || VIEW;               // how far you may pan (the drawn extent)
    var MIN_K = 1, MAX_K = cfg.maxK || 160;
    var nameOf = cfg.fields.name, subOf = cfg.fields.sub;
    var short = cfg.short || function (s) { return s; };
    var majorAttr = cfg.majorAttr || 'data-major';

    /* ---------- the places, read straight out of the page ---------- */
    var places = [].slice.call(list.querySelectorAll('.place')).map(function (li) {
      var note = (li.querySelector('.note') || {}).textContent || '';
      var name = li.dataset[nameOf] || '';
      var sub = li.dataset[subOf] || '';

      // the name / sub · date line is printed from the data- attributes, so
      // a place is described in exactly one spot in map.html
      var head = document.createElement('span');
      head.className = 'p-city';
      head.textContent = name;
      var meta = document.createElement('span');
      meta.className = 'p-meta';
      meta.textContent = [short(sub) === name ? '' : short(sub), li.dataset.when || '']
        .filter(Boolean).join(' · ');
      li.insertBefore(meta, li.firstChild);
      li.insertBefore(head, li.firstChild);

      return {
        el: li,
        city: name,
        country: sub,
        when: li.dataset.when || '',
        note: note.trim(),
        major: li.hasAttribute(majorAttr),     // labelled early — see the header
        lat: parseFloat(li.dataset.lat),
        lon: parseFloat(li.dataset.lon)
      };
    }).filter(function (p) { return isFinite(p.lat) && isFinite(p.lon); });

    /* city-states name themselves twice otherwise: "Singapore, Singapore" */
    function where(p) {
      var c = short(p.country);
      return (!c || c === p.city) ? p.city : p.city + ', ' + c;
    }

    var onRegion = {};     // regions that hold at least one pin
    var selfNamed = {};    // ...and whose name a pin already prints
    places.forEach(function (p) {
      if (!p.country) return;
      onRegion[p.country] = true;
      if (short(p.country) === p.city) selfNamed[p.country] = true;
    });

    /* ---------- build the map ---------- */
    svg.setAttribute('viewBox', VIEW.x + ' ' + VIEW.y + ' ' + VIEW.w + ' ' + VIEW.h);
    var root = el('g', { class: 'wm-root' });
    svg.appendChild(root);

    root.appendChild(el('rect', {
      class: 'wm-sea', x: EDGE.x, y: EDGE.y, width: EDGE.w, height: EDGE.h
    }));

    /* graticule — fades in from tier z2 so the world read stays clean */
    if (cfg.graticule) {
      var grat = el('g', { class: 'wm-grat' });
      cfg.graticule().forEach(function (l) {
        grat.appendChild(el('line', {
          x1: l[0], y1: l[1], x2: l[2], y2: l[3], 'vector-effect': 'non-scaling-stroke'
        }));
      });
      root.appendChild(grat);
    }

    /* an optional backdrop: land that is drawn but is not part of the
       subject (the prefectures around Tokyo), no borders, no labels */
    if (cfg.context) {
      var ctxG = el('g', { class: 'wm-ctx' });
      cfg.context.forEach(function (d) { ctxG.appendChild(el('path', { d: d })); });
      root.appendChild(ctxG);
    }

    var landG = el('g', { class: 'wm-land' });
    var labelG = el('g', { class: 'wm-clabels' });
    var regionLabels = [];
    cfg.regions.forEach(function (c) {
      var tint = cfg.tint && onRegion[c.n];
      var path = el('path', {
        class: 'wm-c' + (tint ? ' on' : ''), d: c.d, 'vector-effect': 'non-scaling-stroke'
      });
      var t = el('title', {});
      t.textContent = c.n;
      path.appendChild(t);
      landG.appendChild(path);

      var text = cfg.regionLabel(c, onRegion[c.n], selfNamed[c.n]);
      if (text) {
        var g = el('g', { class: 'wm-clabel', transform: 'translate(' + c.c[0] + ',' + c.c[1] + ')' });
        var txt = el('text', { x: 0, y: 0, 'text-anchor': 'middle' });
        txt.textContent = text;
        g.appendChild(txt);
        labelG.appendChild(g);
        regionLabels.push(g);
      }
    });
    root.appendChild(landG);
    root.appendChild(labelG);

    /* pins — one group per place, counter-scaled so they stay the same size
       on screen however far you zoom in */
    var pinG = el('g', { class: 'wm-pins' });
    var markers = [];
    places.forEach(function (p) {
      var xy = cfg.project(p.lat, p.lon);
      p.x = xy.x; p.y = xy.y;

      var g = el('g', {
        class: 'wm-pin' + (p.major ? ' major' : ''),
        transform: 'translate(' + p.x + ',' + p.y + ')',
        tabindex: '0', role: 'button'
      });
      var inner = el('g', { class: 'wm-pinI' });

      // one flat dot, no halo and no outline — small on purpose, since a
      // hundred-odd of them have to sit in Europe at once. The hit circle is
      // invisible and only widens the click target.
      inner.appendChild(el('circle', { class: 'wm-dot', r: 3 }));
      inner.appendChild(el('circle', { class: 'wm-hit', r: 11 }));

      var lab = el('g', { class: 'wm-plabel', transform: 'translate(9,0)' });
      var city = el('text', { class: 'wm-city', x: 0, y: 3.5 });
      city.textContent = p.city;
      lab.appendChild(city);

      // the date rides along under every name at the closest tier; the note
      // is longer, so it only opens up for the pin you picked
      var det = el('text', { class: 'wm-pdetail', x: 0, y: 15 });
      det.textContent = p.when;
      lab.appendChild(det);

      var note = el('text', { class: 'wm-pnote', x: 0, y: p.when ? 26 : 15 });
      note.textContent = p.note.length > 52 ? p.note.slice(0, 51) + '…' : p.note;
      lab.appendChild(note);
      inner.appendChild(lab);

      var ttl = el('title', {});
      ttl.textContent = where(p);
      g.appendChild(ttl);

      g.appendChild(inner);
      pinG.appendChild(g);
      p.g = g;
      p.inner = inner;
      markers.push(p);
    });
    root.appendChild(pinG);

    /* ---------- caption: counted, not typed ---------- */
    if (caption && cfg.caption2) {
      caption.textContent = cfg.caption2({
        places: places.length,
        regions: Object.keys(onRegion).length,
        majors: places.filter(function (p) { return p.major; }).length
      });
    }

    /* ---------- transform state ---------- */
    var k = 1, tx = 0, ty = 0;        // screen = world * k + t   (in viewBox units)
    var ppu = 1;                      // css px per viewBox unit at k = 1

    /* the svg's own matrix, not its width: on a narrow screen the map box is
       taller than the drawing and it gets letterboxed inside it, so screen px
       per viewBox unit is the only reliable measure */
    function measure() {
      var m = svg.getScreenCTM();
      ppu = m && m.a ? m.a : 1;
    }

    function clamp() {
      k = Math.min(MAX_K, Math.max(MIN_K, k));
      tx = Math.min(VIEW.x - EDGE.x * k, Math.max(VIEW.x + VIEW.w - (EDGE.x + EDGE.w) * k, tx));
      ty = Math.min(VIEW.y - EDGE.y * k, Math.max(VIEW.y + VIEW.h - (EDGE.y + EDGE.h) * k, ty));
    }

    /* What the view is actually showing on the ground: how many kilometres fit
       across the map right now. Everything that keys off "how close am I"
       reads this, not k. */
    function viewKm() {
      var r = svg.getBoundingClientRect();
      var centreY = ((VIEW.y + VIEW.h / 2) - ty) / k;
      var kmPerUnit = cfg.kmPerUnit(centreY);
      return { kmPerUnit: kmPerUnit, span: ((r.width / ppu) / k) * kmPerUnit };
    }

    var tier = '';
    function apply() {
      clamp();
      root.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + k + ')');

      // keep pins and labels at a constant on-screen size
      var s = 1 / (k * ppu);
      var st = 'scale(' + s + ')';
      for (var i = 0; i < markers.length; i++) markers[i].inner.setAttribute('transform', st);
      for (var j = 0; j < regionLabels.length; j++) {
        var c = regionLabels[j];
        c.setAttribute('transform', c.getAttribute('transform').replace(/ scale\([^)]*\)/, '') + ' ' + st);
      }

      var view = viewKm();
      var want = 'z1';
      for (var t = 0; t < cfg.tiers.length; t++) {
        if (view.span <= cfg.tiers[t].km) { want = cfg.tiers[t].c; break; }
      }
      if (want !== tier) {
        stage.classList.remove('z1', 'z2', 'z3', 'z4', 'z5');
        stage.classList.add(want);
        tier = want;
      }
      drawScale(view);
    }

    /* a real distance bar, so "zoomed in to city level" means something */
    function drawScale(view) {
      if (!scaleBar) return;
      var kmPerPx = view.kmPerUnit / (ppu * k);
      var target = 78 * kmPerPx;                       // aim for a ~78px bar
      var pow = Math.pow(10, Math.floor(Math.log(target) / Math.LN10));
      var nice = [1, 2, 5, 10].map(function (m) { return m * pow; })
        .reduce(function (a, b) { return Math.abs(b - target) < Math.abs(a - target) ? b : a; });
      var px = Math.max(24, nice / kmPerPx);
      scaleBar.style.width = px.toFixed(1) + 'px';
      scaleBar.firstChild.textContent = nice >= 1 ? Math.round(nice) + ' km' : Math.round(nice * 1000) + ' m';
    }

    /* ---------- zooming ---------- */
    function zoomAt(factor, vx, vy) {
      stopFly();                       // a fly in progress loses to the user
      var wx = (vx - tx) / k, wy = (vy - ty) / k;
      k = Math.min(MAX_K, Math.max(MIN_K, k * factor));
      tx = vx - wx * k;
      ty = vy - wy * k;
      apply();
    }

    function toView(clientX, clientY) {
      var m = svg.getScreenCTM();
      if (!m) return centre();
      m = m.inverse();
      return {
        x: m.a * clientX + m.c * clientY + m.e,
        y: m.b * clientX + m.d * clientY + m.f
      };
    }

    function centre() { return { x: VIEW.x + VIEW.w / 2, y: VIEW.y + VIEW.h / 2 }; }

    /* trackpad pinch arrives as a wheel event with ctrlKey set; a plain wheel
       is left alone so the page still scrolls past the map */
    svg.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      var d = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      d = Math.max(-30, Math.min(30, d));        // a mouse wheel notch is huge; cap it
      var p = toView(e.clientX, e.clientY);
      zoomAt(Math.exp(-d * 0.01), p.x, p.y);
    }, { passive: false });

    /* touch pinch + drag pan, via pointer events */
    var pointers = {};
    var pinch = null, drag = null, dragged = 0;

    function pointerList() {
      return Object.keys(pointers).map(function (i) { return pointers[i]; });
    }

    svg.addEventListener('pointerdown', function (e) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY, type: e.pointerType };
      dragged = 0;
      stopFly();
      var ps = pointerList();
      if (ps.length === 2) {
        drag = null;
        pinch = gesture(ps);
      } else if (ps.length === 1 && e.pointerType !== 'touch') {
        // no setPointerCapture here: it would swallow the click on a pin.
        // The window listeners below keep the drag alive off the map instead.
        drag = { x: e.clientX, y: e.clientY, moved: 0 };
        stage.classList.add('grabbing');
      }
    });

    function gesture(ps) {
      var dx = ps[0].x - ps[1].x, dy = ps[0].y - ps[1].y;
      return {
        dist: Math.hypot(dx, dy) || 1,
        mid: toView((ps[0].x + ps[1].x) / 2, (ps[0].y + ps[1].y) / 2)
      };
    }

    /* on window, not on the svg, so a drag that runs off the map keeps going */
    window.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId].x = e.clientX;
      pointers[e.pointerId].y = e.clientY;
      var ps = pointerList();

      if (ps.length === 2 && pinch) {
        e.preventDefault();
        var g = gesture(ps);
        // zoom by how much the fingers spread, and pan by how far their
        // midpoint travelled — so a two-finger drag moves the map too
        var wx = (pinch.mid.x - tx) / k, wy = (pinch.mid.y - ty) / k;
        k = Math.min(MAX_K, Math.max(MIN_K, k * (g.dist / pinch.dist)));
        tx = g.mid.x - wx * k;
        ty = g.mid.y - wy * k;
        pinch = g;
        apply();
      } else if (drag) {
        e.preventDefault();
        var sx = (e.clientX - drag.x) / ppu;
        var sy = (e.clientY - drag.y) / ppu;
        drag.moved += Math.abs(sx) + Math.abs(sy);
        tx += sx; ty += sy;
        drag.x = e.clientX; drag.y = e.clientY;
        apply();
      }
    }, { passive: false });

    function endPointer(e) {
      delete pointers[e.pointerId];
      var ps = pointerList();
      if (ps.length < 2) pinch = null;
      if (ps.length === 0) {
        // remember how far the last gesture travelled: the click that follows
        // a pan lands on whatever pin was under the cursor, and shouldn't count
        dragged = drag ? drag.moved : 0;
        drag = null;
        stage.classList.remove('grabbing');
      }
    }
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);

    svg.addEventListener('dblclick', function (e) {
      e.preventDefault();
      var p = toView(e.clientX, e.clientY);
      zoomAt(e.shiftKey ? 1 / 2.2 : 2.2, p.x, p.y);
    });

    /* keyboard: the map is focusable, arrows pan, +/- zoom */
    svg.setAttribute('tabindex', '0');
    svg.addEventListener('keydown', function (e) {
      var step = 40 / k, c = centre(), used = true;
      if (e.key === 'ArrowLeft') tx += step;
      else if (e.key === 'ArrowRight') tx -= step;
      else if (e.key === 'ArrowUp') ty += step;
      else if (e.key === 'ArrowDown') ty -= step;
      else if (e.key === '+' || e.key === '=') zoomAt(1.6, c.x, c.y);
      else if (e.key === '-' || e.key === '_') zoomAt(1 / 1.6, c.x, c.y);
      else if (e.key === '0') reset();
      else used = false;
      if (used) { e.preventDefault(); stopFly(); apply(); }
    });

    /* ---------- fly to a place ---------- */
    var anim = null, settle = null;
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function goTo(state) {
      k = state.k; tx = state.tx; ty = state.ty;
      apply();
    }

    function flyTo(p, targetK) {
      var c = centre();
      var k1 = Math.min(MAX_K, targetK || cfg.flyK || 22);
      var from = { k: k, tx: tx, ty: ty };
      var to = { k: k1, tx: c.x - p.x * k1, ty: c.y - p.y * k1 };
      stopFly();
      if (still) { goTo(to); return; }

      var t0 = performance.now(), dur = 700;
      (function step(now) {
        var u = Math.min(1, (now - t0) / dur);
        var e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;   // easeInOutCubic
        k = from.k + (to.k - from.k) * e;
        tx = from.tx + (to.tx - from.tx) * e;
        ty = from.ty + (to.ty - from.ty) * e;
        apply();
        if (u < 1) anim = requestAnimationFrame(step);
      })(performance.now());

      // frames can be throttled (background tab, low power); land there anyway
      settle = setTimeout(function () { stopFly(); goTo(to); }, dur + 80);
    }

    function stopFly() {
      if (anim) { cancelAnimationFrame(anim); anim = null; }
      if (settle) { clearTimeout(settle); settle = null; }
    }

    function reset() {
      stopFly();
      goTo({ k: 1, tx: 0, ty: 0 });
      setHint();
    }

    /* ---------- readout line under the map ---------- */
    var baseHint = hint ? hint.textContent : '';
    function setHint(p) {
      if (!hint) return;
      if (!p) { hint.textContent = baseHint; hint.classList.remove('readout'); return; }
      hint.textContent = [where(p), p.when, p.note].filter(Boolean).join(' — ');
      hint.classList.add('readout');
    }

    /* ---------- pin <-> list wiring ---------- */
    function select(p, fly) {
      markers.forEach(function (m) { m.g.classList.toggle('on', m === p); });
      pinG.appendChild(p.g);                 // the picked pin draws over its neighbours
      list.querySelectorAll('.place').forEach(function (li) { li.classList.toggle('on', li === p.el); });
      setHint(p);
      if (fly) flyTo(p);
    }

    markers.forEach(function (p) {
      p.g.addEventListener('pointerenter', function () { if (!drag && !pinch) setHint(p); });
      p.g.addEventListener('pointerleave', function () {
        if (!p.g.classList.contains('on')) setHint();
      });
      p.g.addEventListener('click', function (e) {
        if (dragged > 4) return;                        // it was a pan, not a click
        e.stopPropagation();
        select(p, k < (cfg.flyBelowK || 8));
        // only worth chasing the written entry when the list is actually shown
        if (list.offsetParent) {
          p.el.classList.remove('flash');
          void p.el.offsetWidth;
          p.el.classList.add('flash');
          p.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      p.g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(p, true); }
      });

      p.el.addEventListener('click', function () {
        select(p, true);
        stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    /* ---------- buttons ---------- */
    function on(elId, fn) { var b = id(elId); if (b) b.addEventListener('click', fn); }
    on(cfg.zoomIn, function () { var c = centre(); zoomAt(1.8, c.x, c.y); });
    on(cfg.zoomOut, function () { var c = centre(); zoomAt(1 / 1.8, c.x, c.y); });
    on(cfg.zoomReset, reset);

    window.addEventListener('resize', function () { measure(); apply(); });

    measure();
    apply();
  }

  /* ===================================================================
     1. THE WORLD MAP — cities visited
     =================================================================== */
  if (typeof WORLD_COUNTRIES !== 'undefined') {
    /* The projection the country paths in world-data.js were baked in:
       x = (lon+180) * 1000/360,  y = (90-lat) * 500/180. VIEW is the slice
       we draw — Antarctica is dropped, so the world runs y = 14 .. 410. */
    var wx = function (lon) { return (lon + 180) * (1000 / 360); };
    var wy = function (lat) { return (90 - lat) * (500 / 180); };

    /* Long-form country names are only for matching the map data; these are
       what actually gets printed. # EDIT: add a shortening here if a country
       name reads too formally on the page. */
    var SHORT = {
      'United States of America': 'United States',
      'United Kingdom': 'UK',
      'United Arab Emirates': 'UAE',
      'Bosnia and Herzegovina': 'Bosnia',
      'Vatican': 'Vatican City'
    };

    createMap({
      stage: 'map-stage', svg: 'worldmap', list: 'place-list',
      hint: 'map-hint', caption: 'map-caption', scale: 'map-scale',
      zoomIn: 'map-in', zoomOut: 'map-out', zoomReset: 'map-reset',
      view: { x: 0, y: 14, w: 1000, h: 396 },
      edge: { x: 0, y: 14, w: 1000, h: 396 },
      maxK: 160,
      fields: { name: 'city', sub: 'country' },
      short: function (n) { return SHORT[n] || n; },
      regions: WORLD_COUNTRIES,
      tint: true,
      project: function (lat, lon) { return { x: wx(lon), y: wy(lat) }; },
      /* a degree of longitude shrinks towards the poles, so the scale of an
         equirectangular map depends on where you are looking */
      kmPerUnit: function (centreY) {
        var lat = Math.max(-84, Math.min(84, 90 - centreY * (180 / 500)));
        return 0.36 * 111.32 * Math.cos(lat * Math.PI / 180);
      },
      graticule: function () {
        var lines = [], i;
        for (i = -180; i <= 180; i += 20) lines.push([wx(i), 14, wx(i), 410]);
        for (i = -60; i <= 80; i += 20) lines.push([0, wy(i), 1000, wy(i)]);
        return lines;
      },
      /* Hong Kong, Macao, Singapore, Monaco, the Vatican: the pin already
         says the name, so they get no country label over the top of it */
      regionLabel: function (c, visited, selfNamed) {
        return (visited && !selfNamed) ? (SHORT[c.n] || c.n) : '';
      },
      tiers: [                                  // # EDIT: km across the view
        { km: 250, c: 'z5' },                   // dates
        { km: 500, c: 'z4' },                   // every city name
        { km: 2500, c: 'z3' },                  // capitals + world cities
        { km: 6000, c: 'z2' },                  // graticule + country names
        { km: Infinity, c: 'z1' }
      ],
      caption2: function (n) {
        return n.places + (n.places === 1 ? ' city' : ' cities') +
          ' · ' + n.regions + (n.regions === 1 ? ' country' : ' countries');
      }
    });
  }

  /* ===================================================================
     2. THE US MAP — national parks
     =================================================================== */
  if (typeof US_STATES !== 'undefined') {
    createMap({
      stage: 'parks-stage', svg: 'parksmap', list: 'park-list',
      hint: 'parks-hint', caption: 'parks-caption', scale: 'parks-scale',
      zoomIn: 'parks-in', zoomOut: 'parks-out', zoomReset: 'parks-reset',
      view: US_MAP.view,
      edge: US_MAP.view,
      maxK: 64,
      flyK: 10, flyBelowK: 4,
      fields: { name: 'park', sub: 'state' },
      regions: US_STATES,
      tint: false,
      project: US_PROJECT,
      // Albers is a conic: its scale barely drifts across the country, so one
      // number measured in Kansas is honest everywhere on this map
      kmPerUnit: function () { return US_MAP.kmPerUnit; },
      regionLabel: function (c) { return c.a; },      // the postal code
      tiers: [                                  // # EDIT: km across the view
        { km: 250, c: 'z5' },                   // dates
        { km: 700, c: 'z4' },                   // every park name
        { km: 2000, c: 'z3' },                  // the parks you have been to
        { km: 4000, c: 'z2' },                  // state codes
        { km: Infinity, c: 'z1' }
      ],
      majorAttr: 'data-been',                   // been there = red, and named first
      caption2: function (n) {
        return n.majors + ' of ' + n.places + ' national parks';
      }
    });
  }

  /* ===================================================================
     3. THE TOKYO MAP — neighbourhoods
     =================================================================== */
  if (typeof TOKYO_WARDS !== 'undefined') {
    createMap({
      stage: 'tokyo-stage', svg: 'tokyomap', list: 'hood-list',
      hint: 'tokyo-hint', caption: 'tokyo-caption', scale: 'tokyo-scale',
      zoomIn: 'tokyo-in', zoomOut: 'tokyo-out', zoomReset: 'tokyo-reset',
      view: TOKYO_MAP.view,
      edge: TOKYO_MAP.view,
      maxK: 32,
      flyK: 6, flyBelowK: 3,
      fields: { name: 'hood', sub: 'ward' },
      regions: TOKYO_WARDS.concat(TOKYO_TAMA.map(function (c) {
        return { n: c.n, d: c.d, c: c.c, quiet: true };     // drawn, not named
      })),
      context: TOKYO_CONTEXT,
      tint: false,
      project: TOKYO_PROJECT,
      // 50 km of city: the scale is the same everywhere on a map this small
      kmPerUnit: function () { return TOKYO_MAP.kmPerUnit; },
      // only the 23 wards are named; the Tama cities are there for context
      regionLabel: function (c) { return c.quiet ? '' : c.n; },
      tiers: [                                  // # EDIT: km across the view
        { km: 4,  c: 'z5' },                    // dates
        { km: 12, c: 'z4' },                    // every neighbourhood name
        { km: 30, c: 'z3' },                    // the ones you have been to
        { km: 80, c: 'z2' },                    // ward names
        { km: Infinity, c: 'z1' }
      ],
      majorAttr: 'data-been',                   // been there = red, and named first
      caption2: function (n) {
        return n.majors + ' of ' + n.places + ' Tokyo neighbourhoods';
      }
    });
  }
})();
