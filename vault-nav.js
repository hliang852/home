document.querySelectorAll('.vault-nav').forEach((nav) => {
  const link = nav.querySelector('.vault-nav-heading > a');
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    link.setAttribute('aria-expanded', String(open));
  };
  let touchWasOpen = null;
  link.addEventListener('pointerdown', (event) => {
    touchWasOpen = event.pointerType === 'touch' ? nav.classList.contains('is-open') : null;
  });
  link.addEventListener('click', (event) => {
    if (touchWasOpen === false) {
      event.preventDefault();
      setOpen(true);
    }
    touchWasOpen = null;
  });
  nav.addEventListener('mouseenter', () => setOpen(true));
  nav.addEventListener('mouseleave', () => {
    if (!nav.contains(document.activeElement)) setOpen(false);
  });
  nav.addEventListener('focusin', () => setOpen(true));
  nav.addEventListener('focusout', (event) => {
    if (!nav.contains(event.relatedTarget)) setOpen(false);
  });
  nav.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      link.focus();
      setOpen(false);
      event.preventDefault();
    } else if (event.key === 'ArrowDown' && event.target === link) {
      setOpen(true);
      nav.querySelector('.vault-submenu a').focus();
      event.preventDefault();
    }
  });
  document.addEventListener('click', (event) => {
    if (!nav.contains(event.target)) setOpen(false);
  });
});
