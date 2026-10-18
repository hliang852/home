/* One introduction panel, followed by a continuous profile + explore area. */
(() => {
  const intro = document.getElementById('hello');
  const rest = document.getElementById('home-continuous');
  if(!intro || !rest) return;
  document.body.classList.add('home-panels');
  let introVisible = true;
  let lockedUntil = 0;
  let transitioning = false;
  let initialized = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const show = async (id, updateHash = true) => {
    if(transitioning) return;
    const switching = introVisible !== (id === 'hello');
    const animate = initialized && switching && !reducedMotion;
    introVisible = id === 'hello';
    const incoming = introVisible ? intro : rest;
    const outgoing = introVisible ? rest : intro;
    incoming.hidden = false;
    incoming.inert = false;
    outgoing.inert = true;
    outgoing.hidden = !animate;
    if(!introVisible){
      const target = document.getElementById(id);
      const top = rest.scrollTop + target.getBoundingClientRect().top - rest.getBoundingClientRect().top;
      rest.scrollTo({top, behavior:switching || reducedMotion ? 'instant' : 'smooth'});
    }
    if(updateHash) history.replaceState(null, '', '#' + id);
    initialized = true;

    if(animate){
      transitioning = true;
      const direction = introVisible ? -1 : 1;
      const timing = {duration:700, easing:'cubic-bezier(0.22, 1, 0.36, 1)', fill:'both'};
      const animations = [
        outgoing.animate([
          {opacity:1, transform:'translateY(0)'},
          {opacity:0, transform:`translateY(${-direction * 36}px)`}
        ], timing),
        incoming.animate([
          {opacity:0, transform:`translateY(${direction * 48}px)`},
          {opacity:1, transform:'translateY(0)'}
        ], timing)
      ];
      await Promise.allSettled(animations.map(animation => animation.finished));
      outgoing.hidden = true;
      animations.forEach(animation => animation.cancel());
      transitioning = false;
    }
    if(switching){
      const target = introVisible ? intro : document.getElementById(id);
      target.tabIndex = -1;
      target.focus({preventScroll:true});
      lockedUntil = performance.now() + 180;
    }
  };

  const step = direction => {
    if(transitioning || performance.now() < lockedUntil) return;
    if(introVisible && direction > 0 && intro.scrollTop + intro.clientHeight >= intro.scrollHeight - 2) show('about');
    else if(!introVisible && direction < 0 && rest.scrollTop <= 0) show('hello');
  };
  document.querySelector('.home-scroll').addEventListener('wheel', event => {
    if(transitioning){
      event.preventDefault();
      return;
    }
    if(Math.abs(event.deltaY) < 12) return;
    const atBoundary = introVisible
      ? event.deltaY > 0 && intro.scrollTop + intro.clientHeight >= intro.scrollHeight - 2
      : event.deltaY < 0 && rest.scrollTop <= 0;
    if(atBoundary){
      event.preventDefault();
      step(Math.sign(event.deltaY));
    }
  }, {passive:false});

  let startY = null;
  let startedAtEdge = false;
  document.querySelector('.home-scroll').addEventListener('touchstart', event => {
    startY = event.touches[0]?.clientY;
    startedAtEdge = introVisible ? intro.scrollTop + intro.clientHeight >= intro.scrollHeight - 2 : rest.scrollTop <= 0;
  }, {passive:true});
  document.querySelector('.home-scroll').addEventListener('touchend', event => {
    const distance = startY - event.changedTouches[0]?.clientY;
    if(startedAtEdge && Math.abs(distance) > 45) step(Math.sign(distance));
    startY = null;
  }, {passive:true});

  document.addEventListener('keydown', event => {
    if(event.target.closest('a, button, input, textarea, select, [contenteditable], [role="button"]')) return;
    if(introVisible && ['ArrowDown', 'PageDown', ' '].includes(event.key) && intro.scrollTop + intro.clientHeight >= intro.scrollHeight - 2){
      event.preventDefault();
      step(1);
    }
  });
  document.querySelectorAll('.scroll-nudge').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      show(link.hash.slice(1));
    });
  });
  const fromHash = () => show(['#about', '#explore'].includes(location.hash) ? location.hash.slice(1) : 'hello', false);
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
