'use strict';
// Coached hand replay: steps through a recorded hand and pauses at annotated decisions.
// Shared by the Kaizen GTO "Hand reviews" page and the hand-replay skill, which inlines this file into standalone replays.
// Pack format (version 1): {version:1,title,hands:[{id,title,date,stakes,bb,net,seats:[{n,p,st,hero?,c?}],ev:[...]}]}
// Money is integer cents. Events: ['post',seat,amt] ['refund',seat,amt] ['street',name,cards?] ['fold',seat] ['check',seat]
// ['call',seat,label?] ['bet'|'raise',seat,streetTotal,label?] ['show',seat] ['pause',{k:'m'|'n',t,did,better,why,odds}] ['result',text]
const ReviewReplay = (() => {
 const SUIT={s:'♠',h:'♥',d:'♦',c:'♣'},CARD=/^[2-9TJQKA][shdc]$/;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=c=>(c<0?'−':'')+'$'+(Math.abs(c)/100).toFixed(2);
 const WIDE={s:{6:[[50,86],[10,66],[12,22],[50,12],[88,22],[90,66]],5:[[50,86],[9,56],[28,14],[72,14],[91,56]],4:[[50,86],[10,48],[50,12],[90,48]],3:[[50,86],[16,24],[84,24]],2:[[50,86],[50,12]]},
  c:{6:[[50,66],[27,62],[29,34],[50,29],[71,34],[73,62]],5:[[50,66],[26,54],[38,31],[62,31],[74,54]],4:[[50,66],[27,48],[50,30],[73,48]],3:[[50,66],[32,34],[68,34]],2:[[50,66],[50,30]]}};
 const NARROW={s:{6:[[50,89],[14,68],[14,26],[50,9],[86,26],[86,68]],5:[[50,89],[14,62],[22,14],[78,14],[86,62]],4:[[50,89],[14,48],[50,9],[86,48]],3:[[50,89],[16,20],[84,20]],2:[[50,89],[50,9]]},
  c:{6:[[50,74],[30,60],[30,36],[50,24],[70,36],[70,60]],5:[[50,74],[30,58],[34,30],[66,30],[70,58]],4:[[50,74],[30,48],[50,24],[70,48]],3:[[50,74],[32,32],[68,32]],2:[[50,74],[50,24]]}};

 function validate(pack){
  const fail=m=>{throw new Error('Invalid review pack: '+m);};
  if(!pack||pack.version!==1||!Array.isArray(pack.hands)||!pack.hands.length)fail('expected version 1 with at least one hand.');
  for(const h of pack.hands){
   if(!Array.isArray(h.seats)||h.seats.length<2||h.seats.length>6)fail('each hand needs 2–6 seats.');
   if(h.seats.filter(s=>s.hero).length!==1)fail('each hand needs exactly one hero seat.');
   if(!Number.isInteger(h.bb)||h.bb<=0)fail('bb must be a positive whole number of cents.');
   for(const s of h.seats){if(!Number.isInteger(s.st)||s.st<0)fail('seat stacks must be cents.');if(s.c&&!(Array.isArray(s.c)&&s.c.length===2&&s.c.every(c=>CARD.test(c))))fail('bad hole cards.');}
   if(!Array.isArray(h.ev))fail('missing events.');
   for(const e of h.ev){
    const t=e[0],seatOk=i=>Number.isInteger(i)&&i>=0&&i<h.seats.length;
    if(['post','refund','fold','check','call','bet','raise','show'].includes(t)&&!seatOk(e[1]))fail('event seat out of range.');
    if(t==='street'&&e[2]&&!(Array.isArray(e[2])&&e[2].every(c=>CARD.test(c))))fail('bad board cards.');
    if(['post','refund','bet','raise'].includes(t)&&!(Number.isInteger(e[2])&&e[2]>=0))fail('amounts must be cents.');
    if(t==='pause'&&!(e[1]&&e[1].t))fail('pause needs a title.');
    if(!['post','refund','street','fold','check','call','bet','raise','show','pause','result'].includes(t))fail('unknown event '+t+'.');
   }
  }
  return pack;
 }

 function simulate(h,upto){
  const S=h.seats.map(s=>({...s,stack:s.st,bet:0,folded:false,shown:!!s.hero,last:''}));
  let pot=0,board=[],street='',log=[],acting=-1,pause=null,last=null,result=null;
  const name=s=>s.hero?'You':s.n,line=(s,txt)=>log.push({tx:`${s.p} ${name(s)}: ${txt}`});
  const sweep=()=>{pot+=S.reduce((a,s)=>a+s.bet,0);S.forEach(s=>{s.bet=0;if(!s.folded)s.last='';});};
  for(let i=0;i<=upto&&i<h.ev.length;i++){
   const e=h.ev[i],t=e[0],s=S[e[1]];acting=-1;pause=null;
   if(t==='post'){const a=Math.min(e[2],s.stack);s.bet+=a;s.stack-=a;s.last='posts';}
   else if(t==='refund'){const a=Math.min(e[2],s.bet);s.bet-=a;s.stack+=a;}
   else if(t==='street'){sweep();street=e[1];if(e[2])board=board.concat(e[2]);log.push({hd:e[1]+(e[2]?'  '+e[2].join(' '):'')});}
   else if(t==='fold'){s.folded=true;s.last='fold';acting=e[1];line(s,'folds');}
   else if(t==='check'){s.last='check';acting=e[1];line(s,'checks');}
   else if(t==='call'||t==='bet'||t==='raise'){
    const mx=Math.max(...S.map(x=>x.bet));
    const to=Math.min(t==='call'?mx:e[2],s.bet+s.stack),add=to-s.bet;
    s.stack-=add;s.bet=to;acting=e[1];
    const label=e[t==='call'?2:3]||(t==='call'?'calls '+money(add):t==='bet'?'bets '+money(to):'raises to '+money(to))+(s.stack===0?' (all-in)':'');
    s.last=s.stack===0?'all-in':t==='call'?'call':(t+' '+money(to));line(s,label);
   }
   else if(t==='show'){
    const live=S.filter(x=>!x.folded).map(x=>x.bet).sort((a,b)=>b-a),cap=live.length>1?live[1]:live[0];
    S.forEach(x=>{if(x.bet>cap){x.stack+=x.bet-cap;x.bet=cap;}});
    s.shown=true;if(s.c)log.push({tx:`${s.p} ${name(s)} shows ${s.c.join(' ')}`});
   }
   else if(t==='pause'){pause=e[1];last=e[1];acting=S.findIndex(x=>x.hero);}
   else if(t==='result'){sweep();result=e[1];log.push({tx:e[1]});}
  }
  return {S,pot,total:pot+S.reduce((a,s)=>a+s.bet,0),board,street,log,acting,pause,last,result};
 }

 const cardHtml=c=>c?`<div class="rr-c rr-suit-${c[1]}">${c[0]==='T'?'10':c[0]}<span>${SUIT[c[1]]}</span></div>`:'<div class="rr-c rr-back"></div>';
 let active=null;
 if(typeof document!=='undefined')document.addEventListener('keydown',e=>{
  if(!active||e.target.closest?.('input,textarea,select'))return;
  if(e.key==='ArrowRight'){active.stop();active.go(1);}else if(e.key==='ArrowLeft'){active.stop();active.go(-1);}
  else if(e.key===' '&&!e.target.closest?.('button')){e.preventDefault();active.toggle();}
 });

 function mount(root,pack){
  validate(pack);
  root.innerHTML=`<div class="rr"><div class="rr-tabs" role="tablist"></div><div class="rr-main">
   <section class="rr-stage"><div class="rr-table"><div class="rr-felt"></div><div class="rr-center"><div class="rr-street"></div><div class="rr-board"></div><div class="rr-pot"></div></div></div>
   <div class="rr-controls"><button class="rr-btn" data-a="first" aria-label="Back to start">⏮</button><button class="rr-btn" data-a="prev">◀ Back</button><button class="rr-btn rr-primary" data-a="play">▶ Play</button><button class="rr-btn" data-a="next">Next ▶</button><span class="rr-progress"></span></div></section>
   <aside class="rr-rail"><div class="rr-coach"></div><div class="rr-moments"><h3>Key moments</h3><div class="rr-mlist"></div></div></aside>
   <div class="rr-log" aria-live="polite"></div></div></div>`;
  const q=s=>root.querySelector(s);
  let hi=0,step=0,timer=null;
  const hand=()=>pack.hands[hi],lastStep=()=>hand().ev.length-1;
  const geo=()=>window.matchMedia('(max-width:560px)').matches?NARROW:WIDE;
  function render(){
   const h=hand(),st=simulate(h,step),n=h.seats.length,hx=h.seats.findIndex(s=>s.hero),bbs=c=>(c/h.bb).toFixed(c%h.bb?1:0)+'bb';
   const table=q('.rr-table');table.querySelectorAll('.rr-seat,.rr-chip').forEach(x=>x.remove());
   const G=geo();
   st.S.forEach((s,i)=>{
    const k=(i-hx+n)%n,[x,y]=G.s[n][k];
    const d=document.createElement('div');
    d.className='rr-seat'+(s.hero?' rr-hero':'')+(s.folded?' rr-folded':'')+(st.acting===i?' rr-acting':'');
    d.style.left=x+'%';d.style.top=y+'%';
    const cards=s.c&&s.shown?s.c.map(cardHtml).join(''):(s.folded?'':cardHtml()+cardHtml());
    d.innerHTML=`<div class="rr-top"><span class="rr-pos">${esc(s.p)}</span><span class="rr-stack">${money(s.stack)}</span></div><div class="rr-mid"><span class="rr-name">${esc(s.hero?'You':s.n)}</span><span class="rr-act">${esc(s.last)}</span></div><div class="rr-hole">${cards}</div>`;
    table.appendChild(d);
    if(s.bet>0){const [cx,cy]=G.c[n][k],c=document.createElement('div');c.className='rr-chip';c.style.left=cx+'%';c.style.top=cy+'%';c.textContent=money(s.bet);table.appendChild(c);}
   });
   q('.rr-street').textContent=st.street;
   q('.rr-board').innerHTML=st.board.map(cardHtml).join('');
   q('.rr-pot').textContent='Pot '+money(st.total)+' · '+bbs(st.total);
   const log=q('.rr-log');log.innerHTML=st.log.map((l,i)=>l.hd?`<div class="rr-hd">${esc(l.hd)}</div>`:`<div class="${i===st.log.length-1?'rr-now':'rr-past'}">${esc(l.tx)}</div>`).join('');log.scrollTop=1e6;
   q('.rr-progress').textContent=`${h.id} · step ${step+1} of ${lastStep()+1}`;
   q('[data-a=prev]').disabled=q('[data-a=first]').disabled=step===0;q('[data-a=next]').disabled=step>=lastStep();
   const co=q('.rr-coach'),p=st.pause||(!st.result&&st.last);
   if(p){
    const hero=st.S.find(s=>s.hero);let odds='';
    if(p.odds&&st.pause){
     const mx=Math.max(...st.S.map(s=>s.bet)),call=Math.min(mx-hero.bet,hero.stack),cap=hero.bet+hero.stack;
     const eff=st.pot+st.S.reduce((a,s)=>a+Math.min(s.bet,cap),0);
     if(call>0)odds=`<div class="rr-odds">To call ${money(call)} into ${money(eff)} → you need ${Math.round(call/(eff+call)*100)}% equity</div>`;
    }
    const bad=p.k==='m';
    co.className='rr-coach '+(bad?'rr-mistake':'rr-note')+(st.pause?'':' rr-earlier');
    co.innerHTML=`<span class="rr-tag ${bad?'rr-bad':'rr-ok'}">${st.pause?(bad?'Decision to change':'Your play was fine'):'Earlier decision'}</span><h2>${esc(p.t)}</h2><dl class="rr-vs"><dt>You</dt><dd class="${bad?'rr-did':''}">${esc(p.did)}</dd><dt>Better</dt><dd class="rr-better">${esc(p.better)}</dd></dl>${odds}<p>${esc(p.why)}</p>`;
   } else if(st.result){co.className='rr-coach';co.innerHTML=`<span class="rr-tag rr-gold">Result</span><h2>${esc(h.title)}</h2><p class="rr-result">${esc(st.result)}</p><p>Use Key moments to jump back to a decision.</p>`;}
   else{
    const hero=h.seats.find(s=>s.hero);
    co.className='rr-coach';co.innerHTML=`<span class="rr-tag rr-gold">${esc([h.date,h.stakes,h.id].filter(Boolean).join(' · '))}</span><h2>${esc(h.title)}</h2><p>You are in the ${esc(hero.p)} with ${esc((hero.c||[]).join(' '))}. Press Next or Play; the replay stops at each decision worth reviewing.</p>${Number.isFinite(h.net)?`<p class="rr-result">Net ${money(h.net)} · ${bbs(Math.abs(h.net))}</p>`:''}`;
   }
   root.querySelectorAll('.rr-moment').forEach(m=>m.classList.toggle('rr-on',+m.dataset.step===step));
  }
  function build(){
   const tabs=q('.rr-tabs');
   tabs.innerHTML=pack.hands.map((h,i)=>`<button class="rr-tab" role="tab" aria-selected="${i===hi}" data-i="${i}">${esc(h.title)}${Number.isFinite(h.net)?`<small>${money(h.net)}</small>`:''}</button>`).join('');
   tabs.hidden=pack.hands.length<2;
   tabs.querySelectorAll('.rr-tab').forEach(b=>b.onclick=()=>{hi=+b.dataset.i;step=0;stop();build();});
   const list=q('.rr-mlist');list.innerHTML='';
   hand().ev.forEach((e,i)=>{if(e[0]!=='pause')return;const b=document.createElement('button');b.className='rr-moment';b.dataset.step=i;
    b.innerHTML=`<i class="${e[1].k==='m'?'rr-m':'rr-n'}"></i><span>${esc(e[1].t)}</span>`;b.onclick=()=>{stop();step=i;render();};list.appendChild(b);});
   render();
  }
  function stop(){clearInterval(timer);timer=null;q('[data-a=play]').textContent='▶ Play';}
  function go(d){const t=step+d;if(t<0||t>lastStep()){stop();return;}step=t;render();if(d>0&&(hand().ev[step][0]==='pause'||step>=lastStep()))stop();}
  function toggle(){if(timer){stop();return;}if(step>=lastStep())step=0;q('[data-a=play]').textContent='⏸ Pause';
   const slow=window.matchMedia('(prefers-reduced-motion: reduce)').matches;timer=setInterval(()=>go(1),slow?1400:900);go(1);}
  q('[data-a=next]').onclick=()=>{stop();go(1);};q('[data-a=prev]').onclick=()=>{stop();go(-1);};
  q('[data-a=first]').onclick=()=>{stop();step=0;render();};q('[data-a=play]').onclick=toggle;
  const onResize=()=>render();window.addEventListener('resize',onResize);
  active={stop,go,toggle};build();
  return {destroy(){stop();window.removeEventListener('resize',onResize);root.innerHTML='';active=null;}};
 }
 return {mount,validate,simulate};
})();
if(typeof module!=='undefined')module.exports=ReviewReplay;
