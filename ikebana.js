/* =====================================================================
   IKEBANA.JS — watercolor "field index" for projects.html
   ---------------------------------------------------------------------
   Reads each .proj-entry's hidden data-group (ai / finance / philosophy /
   others) and paints an ikebana arrangement: three flowers + the vase,
   where the vase is the "others" stem. Clicking a flower zooms in and
   blooms that field's projects; clicking the vase reveals its projects as
   little white spots on the surface. Clicking any bloom / spot smooth-
   scrolls to the project card below. The grouping is never shown as text
   on the cards. To move a project between stems, change its data-group.
   ===================================================================== */
(function(){
  const NS='http://www.w3.org/2000/svg';
  // the arrangement is drawn in a 620-wide space; VY..VY+VH is the cropped
  // window shown at rest (a short 240-tall band centred on the content)
  const VW=620, VH=240, VY=52;
  const scene=document.getElementById('ikb-scene'); if(!scene) return;
  const wrap=document.getElementById('ikb-stage');
  const spotsG=document.getElementById('ikb-spots');
  const ovG=document.getElementById('ikb-overlay');
  const nodesG=document.getElementById('ikb-nodes');
  const hintEl=document.getElementById('ikb-hint');
  const backEl=document.getElementById('ikb-back');
  const titleEl=document.getElementById('ikb-gtitle');
  const mk=(n,a={})=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);return e;};
  const rnd=(s=>()=>(s=(s*16807)%2147483647)/2147483647)(42);
  const HINT='✿  Click a flower — or the vase — to open a field';

  // geometry / palette per stem; projects are filled in from the DOM below
  const GROUPS={
    philosophy:{name:'Philosophy',color:'#8A9483',at:[186,120],focus:[186,120],zoom:2.0,
      ring:[186,120,26],label:[186,66],hit:[186,120,44,44],
      center:-104,spread:0,R:60,labelDir:'right',kind:'flower',paint:paintDustyMiller},
    ai:{name:'AI',color:'#E3A518',at:[312,100],focus:[312,100],zoom:2.0,
      ring:[312,100,26],label:[312,64],hit:[312,100,44,44],
      center:-90,spread:56,R:66,labelDir:'auto',kind:'flower',paint:paintMarigold},
    finance:{name:'Finance',color:'#B5322A',at:[450,150],focus:[450,152],zoom:2.0,
      ring:[450,152,26],label:[498,120],hit:[450,152,44,44],
      center:-64,spread:40,R:66,labelDir:'left',kind:'flower',paint:paintHeuchera},
    others:{name:'Others',color:'#6B5A44',focus:[305,238],zoom:2.0,
      ring:[305,246,34],label:[305,262],hit:[305,252,118,42],
      labelDir:'auto',kind:'vase'},
  };
  // candidate white-spot positions on the vase surface (used in order,
  // one per "others" project — extras stay free for future projects)
  const SPOTS=[[300,244],[352,248],[256,246],[386,242],[224,250],
               [330,234],[278,236],[368,256],[240,238]];

  // ---- 1. collect projects from the cards ----
  const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const indexEl=document.querySelector('.ikebana-wrap');   // scroll target for "Top ↑"
  document.querySelectorAll('.proj-entry').forEach(card=>{
    const h4=card.querySelector('h4');
    const title=h4?h4.textContent.trim():'';
    if(!title) return;
    if(!card.id) card.id='proj-'+slug(title);
    let g=(card.dataset.group||'others').toLowerCase();
    if(!GROUPS[g]) g='others';
    (GROUPS[g].projects=GROUPS[g].projects||[]).push({t:title,card});
    // append a "Top ↑" link to each project that returns to the field index
    const body=(card.querySelector('.proj-links')||{}).parentNode||card.lastElementChild;
    if(body && !body.querySelector('.to-top')){
      const top=document.createElement('a');
      top.className='to-top'; top.href='#'; top.textContent='Top ↑';
      top.addEventListener('click',ev=>{ev.preventDefault();
        (indexEl||document.body).scrollIntoView({behavior:'smooth',block:'start'});});
      body.appendChild(top);
    }
  });

  const jumpTo=card=>{
    card.scrollIntoView({behavior:'smooth',block:'start'});
    card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
  };

  // ---- 2. painters (layered translucent watercolor) ----
  function blob(p,cx,cy,rx,ry,fill,op){p.appendChild(mk('ellipse',{cx,cy,rx,ry,fill,'fill-opacity':op}));}
  function paintMarigold(g,cx,cy){
    const q=mk('g',{filter:'url(#ikb-bleedSoft)'});
    blob(q,cx,cy,27,25,'#C8811A',0.35);
    for(let i=0;i<13;i++){const a=i/13*Math.PI*2,r=18+rnd()*6;
      blob(q,cx+Math.cos(a)*r,cy+Math.sin(a)*r,9+rnd()*3,7+rnd()*2,i%2?'#E9A81E':'#F2C230',0.5);}
    for(let i=0;i<7;i++){const a=rnd()*Math.PI*2,r=rnd()*11;
      blob(q,cx+Math.cos(a)*r,cy+Math.sin(a)*r,6,5,'#FBE08A',0.55);}
    blob(q,cx,cy,7,7,'#B5701A',0.5); g.appendChild(q);
  }
  function paintHeuchera(g,cx,cy){
    const q=mk('g',{filter:'url(#ikb-bleedSoft)'});
    const pts=[[cx,cy],[cx-12,cy+14],[cx+10,cy+16],[cx-22,cy+30],[cx+2,cy+32],
               [cx-32,cy+46],[cx-12,cy+50],[cx+13,cy-10],[cx-2,cy-18]];
    pts.forEach((p,i)=>{blob(q,p[0],p[1],5.5+rnd()*2.5,7+rnd()*2,i%3?'#B5322A':'#C7443A',0.55);
      blob(q,p[0]+1.5,p[1]-1.5,3,3.2,'#8E2620',0.6);});
    g.appendChild(q);
  }
  function paintDustyMiller(g,cx,cy){
    const q=mk('g',{filter:'url(#ikb-bleedSoft)'});
    for(let i=0;i<8;i++){const t=i/8,x=cx+Math.sin(t*3)*7,y=cy+20-t*48,side=(i%2?1:-1);
      blob(q,x+side*(8+rnd()*5),y,9+rnd()*2,6+rnd()*2,'#AEB7A6',0.5);
      blob(q,x+side*(11+rnd()*4),y-1.5,5,3.5,'#D2D8CB',0.55);
      blob(q,x,y,5,5,'#9BA692',0.45);}
    g.appendChild(q);
  }
  ['philosophy','ai','finance'].forEach(k=>{
    if((GROUPS[k].projects||[]).length) GROUPS[k].paint(scene.querySelector('.flower.f-'+k),...GROUPS[k].at);
  });

  // ---- 3. faint white spots on the vase for the "others" projects ----
  (GROUPS.others.projects||[]).forEach((p,i)=>{
    const [sx,sy]=SPOTS[i%SPOTS.length];
    const s=mk('circle',{cx:sx,cy:sy,r:2.6,class:'ikb-spot',fill:'#EFEBE0','fill-opacity':0.5});
    p.spot=[sx,sy]; spotsG.appendChild(s);
  });

  // ---- 4. overview: hit areas, hint rings, side labels ----
  Object.keys(GROUPS).forEach(key=>{
    const G=GROUPS[key]; if(!(G.projects||[]).length) return;
    const [hx,hy,hrx,hry]=G.hit;
    const hit=mk('ellipse',{cx:hx,cy:hy,rx:hrx,ry:hry,class:'ikb-hit'});
    hit.addEventListener('click',()=>open(key)); ovG.appendChild(hit);
    const [rx,ry,rr]=G.ring;
    ovG.appendChild(mk('circle',{cx:rx,cy:ry,r:rr,class:'ikb-ring',stroke:G.color}));
    // the vase's "Others" label sits ON the vase in white so it reads as a
    // clickable surface; the flower labels float above their blooms
    const [lx,ly]=G.label, vase=key==='others';
    const lab=mk('text',{x:lx,y:ly,class:'ikb-olabel'+(vase?' ikb-vaselabel':''),'text-anchor':'middle'});
    lab.textContent=G.name; ovG.appendChild(lab);
  });

  // ---- 5. build a field's project nodes (blooms, or vase spots) ----
  const nodeCache={};
  function buildNodes(key){
    const G=GROUPS[key], projects=G.projects||[], n=projects.length, built=[];
    projects.forEach((p,i)=>{
      let px,py,fx,fy;
      if(G.kind==='vase'){ [px,py]=p.spot; [fx,fy]=p.spot; }
      else{
        [fx,fy]=G.focus;
        const ang=(G.center+(n>1?(i-(n-1)/2)*G.spread:0))*Math.PI/180;
        px=fx+Math.cos(ang)*G.R; py=fy+Math.sin(ang)*G.R;
      }
      const node=mk('g',{class:'ikb-node'});
      if(G.kind==='vase'){
        node.appendChild(mk('circle',{cx:px,cy:py,r:5.5,fill:'#F4F1E8','fill-opacity':0.95,
          stroke:G.color,'stroke-width':0.8,'stroke-opacity':0.6}));
      }else{
        node.appendChild(mk('line',{x1:fx,y1:fy,x2:px,y2:py,stroke:G.color,'stroke-width':1,opacity:0.5}));
        const b=mk('g',{filter:'url(#ikb-bleedSoft)'});
        blob(b,px,py,10,9,G.color,0.35); blob(b,px-2,py-1.5,5,5,G.color,0.55);
        blob(b,px+2,py+1.5,3.5,3.5,'#ffffff',0.4); node.appendChild(b);
      }
      // compact bloom label: text before a colon (full name stays on the
      // card + in the readout), so long titles don't overlap neighbours
      const label=(p.t.split(':')[0]||p.t).trim();
      const right=G.labelDir==='left'?false:G.labelDir==='right'?true:px>=(G.kind==='vase'?360:fx);
      const tx=px+(right?14:-14), ty=py+2.5, w=label.length*3.7+9;
      node.appendChild(mk('rect',{class:'plate',x:tx-(right?3:w-3),y:ty-7,width:w,height:11,rx:2.5}));
      const txt=mk('text',{x:tx,y:ty,'text-anchor':right?'start':'end'});
      txt.textContent=label; node.appendChild(txt);
      node.addEventListener('click',ev=>{ev.stopPropagation();
        hintEl.textContent='→ '+p.t; hintEl.classList.add('readout'); jumpTo(p.card);});
      nodesG.appendChild(node); built.push(node);
    });
    return built;
  }

  // ---- 6. viewBox zoom tween ----
  let vb={x:0,y:VY,w:VW,h:VH}, anim=null;
  const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  function tween(to,dur=720){
    const from={...vb},t0=performance.now(); cancelAnimationFrame(anim);
    (function frame(now){const k=Math.min(1,(now-t0)/dur),e=ease(k);
      vb={x:from.x+(to.x-from.x)*e,y:from.y+(to.y-from.y)*e,
          w:from.w+(to.w-from.w)*e,h:from.h+(to.h-from.h)*e};
      scene.setAttribute('viewBox',`${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
      if(k<1)anim=requestAnimationFrame(frame);})(t0);
  }

  // ---- 7. open / close a field ----
  let current=null;
  function open(key){
    const G=GROUPS[key]; if(current===key||!(G.projects||[]).length) return;
    current=key;
    const [fx,fy]=G.focus, z=G.zoom||2.3, w=VW/z, h=VH/z;
    scene.classList.remove('sway','show-hints'); wrap.classList.add('zoomed');
    scene.querySelectorAll('.flower').forEach(f=>f.style.opacity=f.classList.contains('f-'+key)?1:0.12);
    ovG.querySelectorAll('.ikb-olabel').forEach(l=>l.style.opacity=0);
    ovG.querySelectorAll('.ikb-ring').forEach(r=>r.style.opacity=0);
    ovG.querySelectorAll('.ikb-hit').forEach(hh=>hh.style.pointerEvents='none');
    nodesG.querySelectorAll('.ikb-node').forEach(nn=>nn.classList.remove('on'));
    if(!nodeCache[key]) nodeCache[key]=buildNodes(key);
    setTimeout(()=>nodeCache[key].forEach(nn=>nn.classList.add('on')),240);
    titleEl.querySelector('.g').textContent=G.name;
    const c=G.projects.length; titleEl.querySelector('.c').textContent=c+(c===1?' project':' projects');
    hintEl.classList.remove('readout');
    hintEl.textContent=G.kind==='vase'?'Click a spot to open a project':'Click a bloom to open a project';
    // flowers sit high in the banner — frame the focus a little below centre
    // so the fanned blooms + labels have headroom (and clear the back button)
    const vAnchor=G.kind==='vase'?0.5:0.60;
    tween({x:fx-w/2,y:fy-h*vAnchor-4,w,h});
  }
  function close(){
    current=null; wrap.classList.remove('zoomed'); scene.classList.add('sway','show-hints');
    scene.querySelectorAll('.flower').forEach(f=>f.style.opacity=1);
    ovG.querySelectorAll('.ikb-olabel').forEach(l=>l.style.opacity='');
    ovG.querySelectorAll('.ikb-hit').forEach(hh=>hh.style.pointerEvents='');
    nodesG.querySelectorAll('.ikb-node').forEach(nn=>nn.classList.remove('on'));
    hintEl.classList.remove('readout'); hintEl.textContent=HINT;
    tween({x:0,y:VY,w:VW,h:VH});
  }
  backEl.addEventListener('click',close);

  // deep-link straight to a field: projects.html#ai / #finance / #philosophy / #others
  const h=location.hash.replace('#','');
  if(GROUPS[h]) setTimeout(()=>open(h),300);
})();
