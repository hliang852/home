(() => {
  const scene = document.querySelector('#chest-scene');
  if (!scene) return;
  const trigger = scene.querySelector('.chest-trigger');
  const contents = scene.querySelector('.chest-contents');
  const openChest = () => {
    if (scene.classList.contains('is-open')) return;
    scene.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-label', 'Treasure chest is open');
    contents.inert = false;
  };
  // Reveal once. Leaving the image does not hide or move the links again.
  scene.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'touch') openChest();
  });
  trigger.addEventListener('focus', openChest);
  trigger.addEventListener('click', openChest);
})();
