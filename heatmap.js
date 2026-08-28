/* =====================================================================
   HEATMAP.JS — GitHub-style activity grid for garden-leave.html
   ---------------------------------------------------------------------
   Zero maintenance: it scans every .entry .when on the page for a date
   written like "July 16 2026" (or "Aug 3 2026") and paints one green
   square on exactly that day. The square position always comes from the
   date in the left-hand column — never from today's date. The rolling
   book list gets a yellow square, also on the date written in its .when
   label. Entries with no readable date get no square. Clicking any
   colored square smooth-scrolls to its entry. Each entry also gets a
   "Top ↑" link back to the heatmap.
   ===================================================================== */
(function(){
  const MONTHS = {january:0,february:1,march:2,april:3,may:4,june:5,july:6,
                  august:7,september:8,october:9,november:10,december:11};
  const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // touch devices fire a synthetic mousemove on tap but never mouseleave, which
  // left the tooltip stuck on screen after navigating. Only wire the hover
  // tooltip on devices that can actually hover.
  const canHover = !window.matchMedia || window.matchMedia('(hover: hover)').matches;

  // reads a date out of a .when label. Accepts full or abbreviated months
  // ("July 16 2026", "Aug 3 2026", "Sept. 1, 2026") and tolerates
  // surrounding words, so "Books I Read (rolling) Aug 28 2026" works too.
  const parseWhen = text => {
    const m = (text || '').match(/([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/);
    if(!m) return null;
    const key = m[1].toLowerCase();
    const name = Object.keys(MONTHS).find(n => n === key || n.startsWith(key));
    if(!name) return null;
    return new Date(+m[3], MONTHS[name], +m[2]);
  };

  // the rolling book list gets a yellow square instead of green — find it by
  // heading text so it keeps working wherever the section moves in the page
  const booksEntry = [...document.querySelectorAll('.entry')].find(e =>
    /^\s*books i read/i.test((e.querySelector('.when')||{textContent:''}).textContent));

  // ---- 1. scan entries for dates like "July 16 2026" ----
  const entryByDay = new Map(); // Date.toDateString() -> entry element
  let earliest = null, booksDay = null;
  document.querySelectorAll('.entry').forEach(entry => {
    const whenEl = entry.querySelector('.when');
    if(!whenEl) return;
    const d = parseWhen(whenEl.textContent);
    if(!d) return;
    if(entry === booksEntry){ booksDay = d; return; } // its own colour, kept out of the count
    entryByDay.set(d.toDateString(), entry);
    if(!earliest || d < earliest) earliest = d;
  });
  // append a "Top ↑" link to every entry that returns to the heatmap
  // (mirrors the same link on the projects page — see ikebana.js)
  const indexEl = document.querySelector('.heatmap-wrap'); // scroll target for "Top ↑"
  document.querySelectorAll('.entry').forEach(entry => {
    const body = entry.lastElementChild;
    if(!body || body.querySelector('.to-top')) return;
    const top = document.createElement('a');
    top.className = 'to-top'; top.href = '#'; top.textContent = 'Top ↑';
    top.addEventListener('click', ev => { ev.preventDefault();
      (indexEl || document.body).scrollIntoView({behavior:'smooth', block:'start'}); });
    body.appendChild(top);
  });

  if(!earliest) return;

  const jumpTo = el => {
    const t = document.getElementById('hm-tip');
    if(t) t.style.display = 'none';    // never leave the tooltip stuck after a tap
    el.scrollIntoView({behavior:'smooth', block:'start'});
    el.classList.remove('flash');
    void el.offsetWidth;               // restart animation
    el.classList.add('flash');
  };

  // ---- 2. build the grid: from the Sunday before the first entry through today ----
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(earliest); start.setDate(start.getDate() - start.getDay()); // snap to Sunday
  const end = new Date(Math.max(today, ...[...entryByDay.keys()].map(k => new Date(k)),
                                ...(booksDay ? [booksDay] : [])));

  const grid = document.getElementById('heatmap');
  const tip = document.getElementById('hm-tip');
  if(!grid || !tip) return;
  let cur = new Date(start);
  let lastMonthLabeled = -1;

  while(cur <= end || cur.getDay() !== 0){ // finish out the final week
    if(cur.getDay() === 0){
      // month label cell tops each week-column; label when a new month begins in this week
      const label = document.createElement('div');
      label.className = 'hm-month';
      const weekEnd = new Date(cur); weekEnd.setDate(weekEnd.getDate() + 6);
      const monToShow = (cur.getMonth() !== lastMonthLabeled) ? cur.getMonth()
                      : (weekEnd.getMonth() !== lastMonthLabeled) ? weekEnd.getMonth() : -1;
      if(monToShow >= 0){ label.textContent = MONTH_ABBR[monToShow]; lastMonthLabeled = monToShow; }
      grid.appendChild(label);
    }
    const cell = document.createElement('div');
    cell.className = 'hm-cell';
    if(cur < earliest || cur > end){
      cell.classList.add('out');
    } else {
      const key = cur.toDateString();
      const entry = entryByDay.get(key);
      const dateStr = MONTH_ABBR[cur.getMonth()] + ' ' + cur.getDate() + ', ' + cur.getFullYear();
      if(entry){
        cell.classList.add('filled');
        cell.dataset.tip = dateStr + ' — click to read';
        cell.addEventListener('click', () => jumpTo(entry));
      } else if(booksEntry && booksDay && cur.getTime() === booksDay.getTime()){
        // book list sits on the date written in its own .when label
        cell.classList.add('books');
        cell.dataset.tip = dateStr + ' — book list, click to read';
        cell.addEventListener('click', () => jumpTo(booksEntry));
      } else {
        cell.dataset.tip = dateStr;
      }
      if(canHover){
        cell.addEventListener('mousemove', e => {
          tip.textContent = cell.dataset.tip;
          tip.style.display = 'block';
          tip.style.left = e.clientX + 'px';
          tip.style.top = e.clientY + 'px';
        });
        cell.addEventListener('mouseleave', () => tip.style.display = 'none');
      }
    }
    grid.appendChild(cell);
    cur.setDate(cur.getDate() + 1);
  }

  // ---- 3. day-of-week labels (Mon / Wed / Fri, GitHub-style) ----
  const dl = document.getElementById('hm-daylabels');
  if(dl){
    dl.appendChild(document.createElement('span')); // spacer over month row
    ['','Mon','','Wed','','Fri',''].forEach(t => {
      const s = document.createElement('span'); s.textContent = t; dl.appendChild(s);
    });
  }

  // ---- 4. legend book square: same jump as the grid's Tuesday cell ----
  const booksCell = document.getElementById('hm-books');
  if(booksCell && booksEntry){
    booksCell.dataset.tip = 'Books I Read — click to read';
    booksCell.addEventListener('click', () => jumpTo(booksEntry));
    if(canHover){
      booksCell.addEventListener('mousemove', e => {
        tip.textContent = booksCell.dataset.tip;
        tip.style.display = 'block';
        tip.style.left = e.clientX + 'px';
        tip.style.top = e.clientY + 'px';
      });
      booksCell.addEventListener('mouseleave', () => tip.style.display = 'none');
    }
  } else if(booksCell){
    booksCell.style.display = 'none'; // hide legend square if the section is ever removed
    booksCell.nextElementSibling.style.display = 'none';
  }

  // ---- 5. caption with entry count ----
  const n = entryByDay.size;
  const cap = document.getElementById('hm-caption');
  if(cap) cap.textContent =
    n + ' journal entries since ' + MONTH_ABBR[earliest.getMonth()] + ' ' +
    earliest.getDate() + ', ' + earliest.getFullYear();
})();
