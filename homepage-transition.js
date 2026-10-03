(() => {
  const container = document.querySelector('.home-scroll');
  const panels = [...document.querySelectorAll('.home-screen')];
  const panelJumps = [...document.querySelectorAll('.panel-jump')];
  if (!container || panels.length < 2) return;

  let activeIndex = 0;
  let locked = false;
  let touchStartY = null;

  const applyState = (updateHash = true) => {
    panels.forEach((panel, index) => {
      const active = index === activeIndex;
      panel.classList.toggle('is-active', active);
      panel.classList.toggle('is-before', index < activeIndex);
      panel.classList.toggle('is-after', index > activeIndex);
      panel.setAttribute('aria-hidden', String(!active));
      panel.inert = !active;
      if (active) panel.scrollTop = 0;
    });
    panelJumps.forEach((link, index) => {
      const active = index === activeIndex;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });

    if (updateHash) history.replaceState(null, '', `#${panels[activeIndex].id}`);
  };

  const showPanel = (nextIndex, updateHash = true) => {
    if (nextIndex === activeIndex || nextIndex < 0 || nextIndex >= panels.length || locked) return;
    locked = true;
    activeIndex = nextIndex;
    applyState(updateHash);
    window.setTimeout(() => { locked = false; }, 650);
  };

  container.addEventListener('wheel', (event) => {
    if (Math.abs(event.deltaY) < 12) return;
    const panel = panels[activeIndex];
    const maxScroll = panel.scrollHeight - panel.clientHeight;
    if (event.deltaY > 0 && panel.scrollTop < maxScroll - 2) return;
    if (event.deltaY < 0 && panel.scrollTop > 2) return;
    event.preventDefault();
    showPanel(activeIndex + (event.deltaY > 0 ? 1 : -1));
  }, { passive: false });

  container.addEventListener('touchstart', (event) => {
    touchStartY = event.touches[0]?.clientY ?? null;
  }, { passive: true });

  container.addEventListener('touchend', (event) => {
    if (touchStartY === null) return;
    const endY = event.changedTouches[0]?.clientY ?? touchStartY;
    const distance = touchStartY - endY;
    touchStartY = null;
    if (Math.abs(distance) <= 45) return;
    const panel = panels[activeIndex];
    const maxScroll = panel.scrollHeight - panel.clientHeight;
    if (distance > 0 && panel.scrollTop >= maxScroll - 2) showPanel(activeIndex + 1);
    if (distance < 0 && panel.scrollTop <= 2) showPanel(activeIndex - 1);
  }, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (event.target.closest('a, button, input, textarea, select, [contenteditable="true"]')) return;
    if (['ArrowDown', 'PageDown', ' '].includes(event.key)) {
      event.preventDefault();
      showPanel(activeIndex + 1);
    } else if (['ArrowUp', 'PageUp'].includes(event.key)) {
      event.preventDefault();
      showPanel(activeIndex - 1);
    }
  });

  document.querySelectorAll('.scroll-nudge, .panel-jump').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const targetIndex = panels.findIndex((panel) => `#${panel.id}` === link.getAttribute('href'));
      showPanel(targetIndex);
    });
  });

  const hashIndex = panels.findIndex((panel) => `#${panel.id}` === window.location.hash);
  activeIndex = hashIndex >= 0 ? hashIndex : 0;
  applyState(false);
})();
