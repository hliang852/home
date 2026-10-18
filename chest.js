(() => {
  const scene = document.querySelector('#chest-scene');
  if (!scene) return;
  const trigger = scene.querySelector('.chest-trigger');
  const contents = scene.querySelector('.chest-contents');
  const setOpen = (open) => {
    scene.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    trigger.setAttribute('aria-label', open ? 'Treasure chest is open' : 'Open the treasure chest');
    contents.inert = !open;
  };
  const openChest = () => setOpen(true);
  // Keep the revealed links reachable while the pointer is inside the scene.
  scene.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'touch') openChest();
  });
  scene.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'touch') setOpen(false);
  });
  scene.addEventListener('focusout', (event) => {
    if (!scene.contains(event.relatedTarget) && !scene.matches(':hover')) setOpen(false);
  });
  trigger.addEventListener('focus', openChest);
  trigger.addEventListener('click', openChest);
})();
