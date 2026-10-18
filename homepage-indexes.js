/* Reuse the source pages so the homepage navigation stays current. */
(() => {
  const widgets = [
    {source:'projects.html', selector:'.ikebana-wrap', entries:'.proj-entry', script:'ikebana.js'},
    {source:'garden-leave.html', selector:'.heatmap-wrap', entries:'.entry', script:'heatmap.js'}
  ];
  widgets.forEach(async config => {
    const host = document.querySelector(`[data-source="${config.source}"]`);
    if(!host) return;
    try {
      const response = await fetch(config.source);
      if(!response.ok) throw new Error('Unable to load navigation');
      const source = new DOMParser().parseFromString(await response.text(), 'text/html');
      const widget = source.querySelector(config.selector);
      if(!widget) throw new Error('Navigation missing');
      const data = document.createElement('div');
      data.hidden = true;
      source.querySelectorAll(config.entries).forEach(entry => data.appendChild(entry));
      host.replaceChildren(widget, data);
      if(config.script === 'heatmap.js'){
        const tip = document.createElement('div');
        tip.className = 'hm-tip';
        tip.id = 'hm-tip';
        document.body.appendChild(tip);
      }
      const script = document.createElement('script');
      script.src = config.script;
      document.body.appendChild(script);
    } catch(error) {
      // Keep the original page link available if loading is unavailable.
      console.warn('Homepage navigation:', config.source, error);
    } finally {
      host.setAttribute('aria-busy', 'false');
    }
  });
})();
