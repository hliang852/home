(() => {
  'use strict';
  const data = window.KNOWLEDGE_DATA;
  if (!data) return;
  const root = document.getElementById('knowledge-map');
  if (!root) return;
  const $ = s => root.querySelector(s);
  const svg = $('#knowledge-graph'), NS = 'http://www.w3.org/2000/svg';
  const topics = data.topics.map(t => ({...t, articles:data.articles.filter(a => a.topics.includes(t.id))}));
  // Related themes share a neighborhood. Positions are editorial groupings,
  // not a statistical distance; edges still reflect shared reading.
  const positions = {
    banking:[105,100], investing:[220,190], credit:[105,260], macro:[245,320],
    deals:[350,90],
    infrastructure:[495,65], ai:[520,190], safety:[610,110], society:[470,335],
    energy:[715,100], geopolitics:[815,65],
    japan:[800,205], consumer:[920,165], health:[925,300], other:[770,345]
  };
  // Ochre blooms, rust flowers and sage leaves from the Projects ikebana;
  // related topics share a pigment rather than each getting a different hue.
  const pigments={
    ai:'#D5AD51', infrastructure:'#D5AD51', safety:'#D5AD51',
    banking:'#C88C75', credit:'#C88C75', investing:'#C88C75', macro:'#C88C75', deals:'#C88C75',
    energy:'#A8B58D', geopolitics:'#A8B58D', society:'#A8B58D', health:'#A8B58D',
    japan:'#C2AC87', consumer:'#C2AC87', other:'#C2BBAA'
  };
  topics.forEach((t,i) => {
    [t.x,t.y]=positions[t.id] || [500,200];
    // Preserve the reading hierarchy; only the smallest topics get a label floor.
    t.r=Math.max(26,Math.sqrt(t.articles.length)*5.4);
    t.color=pigments[t.id] || '#C2BBAA';
  });
  const edges=[];
  topics.forEach((a,i)=>topics.slice(i+1).forEach(b=>{
    const articles=a.articles.filter(x=>x.topics.includes(b.id));
    if(articles.length)edges.push({a,b,articles});
  }));
  let selected=null, suppressClickUntil=0;
  let nodeElements=[], edgeElements=[];
  function make(tag,attrs,parent){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));parent.append(e);return e;}
  function activate(el,fn){el.addEventListener('click',()=>{if(performance.now()>suppressClickUntil)fn();});el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn();}});}
  function draw(){
    svg.replaceChildren();
    nodeElements=[]; edgeElements=[];
    const min=3;
    edges.filter(e=>e.articles.length>=min).sort((a,b)=>a.articles.length-b.articles.length).forEach(e=>{
      const faded=(selected&&(selected.a?e!==selected:e.a!==selected&&e.b!==selected));
      const g=make('g',{class:'km-edge'+(faded?' km-dim':''),tabindex:'0',role:'button','aria-label':`${e.a.label} and ${e.b.label}: ${e.articles.length} shared articles`},svg);
      const attrs={x1:e.a.x,y1:e.a.y,x2:e.b.x,y2:e.b.y};
      make('line',{...attrs,'stroke-width':.5+Math.sqrt(e.articles.length)*.3},g);
      make('line',{...attrs,class:'km-hit'},g);
      edgeElements.push({e, lines:[...g.querySelectorAll('line')]});
      activate(g,()=>showEdge(e));
    });
    topics.forEach(t=>{
      const faded=(selected&&(selected.a?t!==selected.a&&t!==selected.b:!t.articles.some(a=>selected.articles.includes(a))));
      const g=make('g',{class:'km-node'+(faded?' km-dim':'')+(selected===t?' selected':''),transform:`translate(${t.x},${t.y})`,tabindex:'0',role:'button','aria-label':`${t.label}, ${t.articles.length} articles`},svg);
      make('circle',{r:t.r,fill:t.color},g);
      // Wrap the full topic name and fit it inside an inscribed square.
      const parts=[];
      const targetLength=12;
      t.label.split(' ').forEach(word=>{
        const last=parts.length-1;
        if(last>=0 && parts[last].length+word.length+1<=targetLength) parts[last]+=' '+word;
        else parts.push(word);
      });
      const fontSize=Math.min(17, t.r*1.4/(parts.length*1.15));
      const labels=parts.map((part,i)=>{
        const label=make('text',{y:(i-(parts.length-1)/2)*fontSize*1.15,class:'km-label',style:`font-size:${fontSize}px`,'dominant-baseline':'central'},g);
        label.textContent=part;
        return label;
      });
      const widest=Math.max(...labels.map(label=>label.getComputedTextLength()));
      if(widest>t.r*1.4) labels.forEach(label=>label.style.fontSize=`${fontSize*t.r*1.4/widest}px`);
      nodeElements.push({t,g});
      activate(g,()=>showTopic(t));
    });
  }
  function articleList(articles){
    const ul=document.createElement('ol');ul.className='km-articles';
    articles.forEach(a=>{
      const li=document.createElement('li'),link=document.createElement('a');
      link.textContent=a.title;link.href=a.url||`articles.html#read-${a.date}`;
      const small=document.createElement('small');small.textContent=`Read ${a.date}${a.source?' · '+a.source:''}${!a.url?' · source link unavailable; view log':''}`;
      li.append(link,small);ul.append(li);
    });return ul;
  }
  function detail(title,description,articles){
    const panel=$('#knowledge-detail');panel.replaceChildren();
    const h=document.createElement('h3');h.textContent=title;
    const p=document.createElement('p');p.textContent=description;
    panel.append(h,p);return panel;
  }
  function showTopic(t, reveal=true){
    if (reveal) $('#knowledge-explore').open=true;
    selected=t;
    const panel=detail(t.label,`${t.articles.length} of ${data.articles.length} articles (${Math.round(t.articles.length/data.articles.length*100)}%). ${t.summary}`,t.articles);
    const related=document.createElement('div');related.className='km-related';
    edges.filter(e=>e.a===t||e.b===t).sort((a,b)=>b.articles.length-a.articles.length).forEach(e=>{
      const other=e.a===t?e.b:e.a,b=document.createElement('button');b.type='button';b.textContent=`${other.label} · ${e.articles.length}`;b.onclick=()=>showEdge(e);related.append(b);
    });panel.append(related,articleList(t.articles));draw();
    root.querySelectorAll('.km-topic').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===t.id)));
  }
  function showEdge(e){
    $('#knowledge-explore').open=true;
    selected=e;
    const panel=detail(`${e.a.label} ↔ ${e.b.label}`,`${e.articles.length} article titles touch both topics. This suggests a reading connection, not a verified causal relationship. Read the sources below to investigate it.`,e.articles);
    panel.append(articleList(e.articles));draw();
    root.querySelectorAll('.km-topic').forEach(b=>b.setAttribute('aria-pressed','false'));
  }
  const sorted=[...topics].sort((a,b)=>b.articles.length-a.articles.length);
  $('#knowledge-overview').textContent=`The most-read topics are ${sorted.slice(0,3).map(t=>`${t.label} (${t.articles.length})`).join(', ')}. Explore a circle to see its reading themes, or a line to see the articles connecting two topics.`;
  const dates=data.articles.map(a=>a.date).sort();
  const dateFormat=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
  $('#knowledge-dates').textContent=`${dateFormat.format(new Date(dates[0]))} – ${dateFormat.format(new Date(dates[dates.length-1]))}`;
  $('#knowledge-total').textContent=data.articles.length;
  $('#knowledge-topic-count').textContent=topics.length;
  sorted.forEach(t=>{
    const b=document.createElement('button');b.className='km-topic';b.type='button';b.dataset.id=t.id;b.setAttribute('aria-pressed','false');
    const dot=document.createElement('i');dot.style.background=t.color;
    const label=document.createElement('span');label.textContent=t.label;
    const count=document.createElement('b');count.textContent=t.articles.length;
    b.append(dot,label,count);b.onclick=()=>showTopic(t);$('#knowledge-topics').append(b);
  });
  const resetButton = $('#knowledge-reset');
  if (resetButton) resetButton.onclick=()=>{showTopic(sorted[0]);};
  showTopic(sorted[0], false);
  selected=null;
  draw();

  // Camera coordinates stay independent of the animated node positions.
  let zoom=1, center={x:500,y:200}, baseWidth=1000;
  function camera(){
    const rect=svg.getBoundingClientRect();
    baseWidth=400*rect.width/rect.height;
    const width=baseWidth/zoom, height=400/zoom;
    center.x=Math.max(Math.min(500,width/2),Math.min(1000-Math.min(500,width/2),center.x));
    center.y=Math.max(height/2,Math.min(400-height/2,center.y));
    svg.setAttribute('viewBox',`${center.x-width/2} ${center.y-height/2} ${width} ${height}`);
    if ($('#knowledge-zoom-out')) $('#knowledge-zoom-out').disabled=zoom<=1;
    if ($('#knowledge-zoom-in')) $('#knowledge-zoom-in').disabled=zoom>=4;
  }
  function point(x,y){
    const rect=svg.getBoundingClientRect();
    return {x:center.x+(x-rect.left-rect.width/2)*baseWidth/zoom/rect.width,
            y:center.y+(y-rect.top-rect.height/2)*400/zoom/rect.height};
  }
  function zoomAt(next,x,y){
    const before=point(x,y);
    zoom=Math.max(1,Math.min(4,next));
    const after=point(x,y);
    center.x+=before.x-after.x; center.y+=before.y-after.y;
    camera();
  }
  function zoomCenter(factor){const r=svg.getBoundingClientRect();zoomAt(zoom*factor,r.left+r.width/2,r.top+r.height/2);}
  if ($('#knowledge-zoom-in')) $('#knowledge-zoom-in').onclick=()=>zoomCenter(1.3);
  if ($('#knowledge-zoom-out')) $('#knowledge-zoom-out').onclick=()=>zoomCenter(1/1.3);
  if ($('#knowledge-home')) $('#knowledge-home').onclick=()=>{zoom=1;center={x:500,y:200};camera();};
  new ResizeObserver(camera).observe(svg);
  svg.addEventListener('wheel',e=>{
    if(!e.ctrlKey && !e.metaKey)return;
    e.preventDefault();zoomAt(zoom*Math.exp(-e.deltaY*.01),e.clientX,e.clientY);
  },{passive:false});
  const pointers=new Map();
  let gesture=null;
  function measure(){
    const pts=[...pointers.values()];
    return {x:pts.reduce((n,p)=>n+p.x,0)/pts.length,y:pts.reduce((n,p)=>n+p.y,0)/pts.length,
      distance:pts.length>1?Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y):0};
  }
  svg.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});gesture=measure();
    // Capture on the original target so a tap still activates its topic.
    e.target.setPointerCapture(e.pointerId);
    if(pointers.size>1)suppressClickUntil=performance.now()+500;
  });
  svg.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const next=measure(), rect=svg.getBoundingClientRect();
    const dx=next.x-gesture.x,dy=next.y-gesture.y;
    if(Math.abs(dx)+Math.abs(dy)>2 || pointers.size>1)suppressClickUntil=performance.now()+500;
    center.x-=dx*baseWidth/zoom/rect.width;center.y-=dy*400/zoom/rect.height;
    if(next.distance && gesture.distance)zoomAt(zoom*next.distance/gesture.distance,next.x,next.y);
    else camera();
    gesture=next;
  });
  function release(e){pointers.delete(e.pointerId);gesture=pointers.size?measure():null;}
  svg.addEventListener('pointerup',release);
  svg.addEventListener('pointercancel',release);
  svg.addEventListener('lostpointercapture',release);

  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let visible=true, hovering=false, frame;
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;}).observe(svg);
  svg.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')hovering=true;});
  svg.addEventListener('pointerleave',()=>{hovering=false;});
  function float(time){
    if(visible && !document.hidden && !reducedMotion.matches && !hovering && !pointers.size && !svg.contains(document.activeElement)){
      const positions=new Map(topics.map((t,i)=>[t,{x:t.x+Math.sin(time/2400+i*1.7)*4,y:t.y+Math.cos(time/2900+i*1.3)*4}]));
      nodeElements.forEach(({t,g})=>{const p=positions.get(t);g.setAttribute('transform',`translate(${p.x},${p.y})`);});
      edgeElements.forEach(({e,lines})=>{const a=positions.get(e.a),b=positions.get(e.b);lines.forEach(line=>{line.setAttribute('x1',a.x);line.setAttribute('y1',a.y);line.setAttribute('x2',b.x);line.setAttribute('y2',b.y);});});
    }
    frame=requestAnimationFrame(float);
  }
  frame=requestAnimationFrame(float);
  window.addEventListener('pagehide',()=>cancelAnimationFrame(frame));
  window.addEventListener('pageshow',e=>{if(e.persisted)frame=requestAnimationFrame(float);});
  camera();
  // Refit labels once the shared display font is available.
  document.fonts.ready.then(draw);
})();
