/* =====================================================================
   HEATMAP.JS — GitHub-style activity grid for garden-leave.html
   ---------------------------------------------------------------------
   Zero maintenance: it scans every .entry .when on the page for dates
   written like "July 16 2026" and paints one green square per entry.
   Entries without a date (e.g. "Books I Read (Rolling Updates)") are
   skipped; that section instead gets a yellow square on the latest
   Tuesday, rolling forward each week. Clicking any colored square
   smooth-scrolls to its entry.
   ===================================================================== */
(function(){
  const MONTHS = {january:0,february:1,march:2,april:3,may:4,june:5,july:6,
                  august:7,september:8,october:9,november:10,december:11};
  const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ---- 1. scan entries for dates like "July 16 2026" ----
  const entryByDay = new Map(); // Date.toDateString() -> entry element
  let earliest = null;
  document.querySelectorAll('.entry').forEach(entry => {
    const whenEl = entry.querySelector('.when');
    if(!whenEl) return;
    const m = whenEl.textContent.trim().match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/);
    if(!m) return; // skips "Books I Read (Rolling Updates)" etc.
    const mon = MONTHS[m[1].toLowerCase()];
    if(mon === undefined) return;
    const d = new Date(+m[3], mon, +m[2]);
    entryByDay.set(d.toDateString(), entry);
    if(!earliest || d < earliest) earliest = d;
  });
  if(!earliest) return;

  // the books section has no date of its own — find it by heading text so it
  // keeps working wherever the rolling section moves in the page
  const booksEntry = [...document.querySelectorAll('.entry')].find(e =>
    /^books i read/i.test((e.querySelector('.when')||{textContent:''}).textContent.trim()));

  const jumpTo = el => {
    el.scrollIntoView({behavior:'smooth', block:'start'});
    el.classList.remove('flash');
    void el.offsetWidth;               // restart animation
    el.classList.add('flash');
  };

  // ---- 2. build the grid: from the Sunday before the first entry through today ----
  const today = new Date(); today.setHours(0,0,0,0);
  // most recent Tuesday on or before today — the book list's rolling home
  const latestTue = new Date(today);
  latestTue.setDate(latestTue.getDate() - ((latestTue.getDay() + 5) % 7));
  const start = new Date(earliest); start.setDate(start.getDate() - start.getDay()); // snap to Sunday
  const end = new Date(Math.max(today, ...[...entryByDay.keys()].map(k => new Date(k))));

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
      } else if(booksEntry && cur.getTime() === latestTue.getTime()){
        // book list sits on the latest Tuesday only, rolling forward each week
        cell.classList.add('books');
        cell.dataset.tip = dateStr + ' — book list, click to read';
        cell.addEventListener('click', () => jumpTo(booksEntry));
      } else {
        cell.dataset.tip = dateStr;
      }
      cell.addEventListener('mousemove', e => {
        tip.textContent = cell.dataset.tip;
        tip.style.display = 'block';
        tip.style.left = e.clientX + 'px';
        tip.style.top = e.clientY + 'px';
      });
      cell.addEventListener('mouseleave', () => tip.style.display = 'none');
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
    booksCell.addEventListener('mousemove', e => {
      tip.textContent = booksCell.dataset.tip;
      tip.style.display = 'block';
      tip.style.left = e.clientX + 'px';
      tip.style.top = e.clientY + 'px';
    });
    booksCell.addEventListener('mouseleave', () => tip.style.display = 'none');
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
