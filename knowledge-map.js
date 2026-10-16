(() => {
  'use strict';
  const data = window.KNOWLEDGE_DATA;
  if (!data) return;
  const root = document.getElementById('knowledge-map');
  const $ = s => root.querySelector(s);
  const svg = $('#knowledge-graph'), NS = 'http://www.w3.org/2000/svg';
  const topics = data.topics.map(t => ({...t, articles:data.articles.filter(a => a.topics.includes(t.id))}));
  const byId = Object.fromEntries(topics.map(t => [t.id,t]));
  // Fixed, reproducible composition; circle AREA is proportional to article count.
  const positions = [[380,265],[200,290],[620,380],[465,450],[630,210],[155,455],[360,100],[160,110],[95,275],[730,370],[650,70],[270,560],[760,530],[470,620]];
  topics.forEach((t,i) => { [t.x,t.y]=positions[i]; t.r=Math.sqrt(t.articles.length)*6.25; });
  const edges=[];
  topics.forEach((a,i)=>topics.slice(i+1).forEach(b=>{
    const articles=a.articles.filter(x=>x.topics.includes(b.id));
    if(articles.length)edges.push({a,b,articles});
  }));
  let selected=null, query='';
  function make(tag,attrs,parent){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));parent.append(e);return e;}
  function activate(el,fn){el.addEventListener('click',fn);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn();}});}
  function relevant(t){return !query || t.label.toLowerCase().includes(query) || t.articles.some(a=>a.title.toLowerCase().includes(query));}
  function draw(){
    svg.replaceChildren();
    const min=Number($('#knowledge-strength').value);
    edges.filter(e=>e.articles.length>=min).sort((a,b)=>a.articles.length-b.articles.length).forEach(e=>{
      const faded=(!relevant(e.a)&&!relevant(e.b))||(selected&&(selected.a?e!==selected:e.a!==selected&&e.b!==selected));
      const g=make('g',{class:'km-edge'+(faded?' km-dim':''),tabindex:'0',role:'button','aria-label':`${e.a.label} and ${e.b.label}: ${e.articles.length} shared articles`},svg);
      const attrs={x1:e.a.x,y1:e.a.y,x2:e.b.x,y2:e.b.y};
      make('line',{...attrs,'stroke-width':1+Math.sqrt(e.articles.length)},g);
      make('line',{...attrs,class:'km-hit'},g);
      activate(g,()=>showEdge(e));
    });
    topics.forEach(t=>{
      const faded=!relevant(t)||(selected&&(selected.a?t!==selected.a&&t!==selected.b:!t.articles.some(a=>selected.articles.includes(a))));
      const g=make('g',{class:'km-node'+(faded?' km-dim':'')+(selected===t?' selected':''),transform:`translate(${t.x},${t.y})`,tabindex:'0',role:'button','aria-label':`${t.label}, ${t.articles.length} articles`},svg);
      make('circle',{r:t.r,fill:t.color},g);
      const parts=t.label.split(' & ');
      parts.forEach((p,i)=>{make('text',{y:t.r+17+i*15,class:'km-label'},g).textContent=(i?'& ':'')+p;});
      make('text',{y:7,class:'km-count'},g).textContent=t.articles.length;
      activate(g,()=>showTopic(t));
    });
    $ ('#knowledge-visible').textContent=`${edges.filter(e=>e.articles.length>=min).length} links shown`;
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
  function showTopic(t){
    selected=t;
    const panel=detail(t.label,`${t.articles.length} of ${data.articles.length} articles (${Math.round(t.articles.length/data.articles.length*100)}%). ${t.summary}`,t.articles);
    const related=document.createElement('div');related.className='km-related';
    edges.filter(e=>e.a===t||e.b===t).sort((a,b)=>b.articles.length-a.articles.length).forEach(e=>{
      const other=e.a===t?e.b:e.a,b=document.createElement('button');b.type='button';b.textContent=`${other.label} · ${e.articles.length}`;b.onclick=()=>showEdge(e);related.append(b);
    });panel.append(related,articleList(t.articles));draw();
    root.querySelectorAll('.km-topic').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===t.id)));
  }
  function showEdge(e){
    selected=e;
    const panel=detail(`${e.a.label} ↔ ${e.b.label}`,`${e.articles.length} article titles touch both topics. This suggests a reading connection, not a verified causal relationship. Read the sources below to investigate it.`,e.articles);
    panel.append(articleList(e.articles));draw();
    root.querySelectorAll('.km-topic').forEach(b=>b.setAttribute('aria-pressed','false'));
  }
  const sorted=[...topics].sort((a,b)=>b.articles.length-a.articles.length);
  $('#knowledge-overview').textContent=`Your strongest reading clusters are ${sorted.slice(0,3).map(t=>`${t.label} (${t.articles.length})`).join(', ')}. Explore a circle to see its reading themes, or a line to see the articles connecting two topics.`;
  $('#knowledge-total').textContent=data.articles.length;
  $('#knowledge-topic-count').textContent=topics.length;
  sorted.forEach(t=>{
    const b=document.createElement('button');b.className='km-topic';b.type='button';b.dataset.id=t.id;b.setAttribute('aria-pressed','false');
    const dot=document.createElement('i');dot.style.background=t.color;
    const label=document.createElement('span');label.textContent=t.label;
    const count=document.createElement('b');count.textContent=t.articles.length;
    b.append(dot,label,count);b.onclick=()=>showTopic(t);$('#knowledge-topics').append(b);
  });
  $('#knowledge-search').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();draw();const matches=topics.filter(relevant);$('#knowledge-search-status').textContent=query?`${matches.length} matching topics`:'';});
  $('#knowledge-strength').onchange=draw;
  $('#knowledge-reset').onclick=()=>{query='';$('#knowledge-search').value='';$('#knowledge-search-status').textContent='';$('#knowledge-strength').value='3';showTopic(sorted[0]);};
  showTopic(sorted[0]);
})();
