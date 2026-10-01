'use strict';
const Practice = (() => {
 const day=86400000, intervals=[1,3,7,14];
 function stats(records, area) {
  const scored=records.filter(r=>r.grade!=='unscored'&&r.sourceType!=='solver-model'&&!r.strategy&&(!area||r.area===area));
  const last=scored.slice(-12);
  const successes=last.filter(r=>r.grade==='good'||r.grade==='reasonable').length;
  const distinct=new Set(scored.map(r=>r.spotId)).size;
  const dates=new Set(scored.map(r=>r.time.slice(0,10))).size;
  return {count:scored.length,accuracy:last.length?successes/last.length:0,distinct,dates,
   maintenance:scored.length>=8&&distinct>=3&&dates>=3&&last.length>=8&&successes/last.length>=.85};
 }
 function level(records) {const s=stats(records);return s.count>=12&&s.accuracy>=.8?2:1;}
 function memory(records,spotId,now=Date.now()) {
  const rows=records.filter(r=>r.spotId===spotId&&r.grade!=='unscored');
  if(!rows.length)return {due:true,successes:0,last:null,ready:true};
  let successes=0;
  for(let i=rows.length-1;i>=0&&rows[i].grade==='good';i--)successes++;
  const last=rows.at(-1),lastIndex=records.indexOf(last);
  const dueAt=Date.parse(last.time)+(last.grade==='good'?intervals[Math.min(successes-1,3)]*day:0);
  return {due:now>=dueAt,dueAt,successes,last,ready:last.grade==='good'||records.length-lastIndex>3};
 }
 function weight(spot,records,imports,now=Date.now()) {
  if(spot.sourceType==='history')return .4;
  const priority=typeof CORPUS!=='undefined'&&spot.profile==='online'?CORPUS.priorities.find(p=>p.area===spot.area):null;
  const seed=priority?.weight||(spot.area==='value'&&spot.profile==='live'?2:spot.area==='draws'?2:1);
  const topic=imports.some(i=>i.kind==='report'&&i.themes?.includes(spot.area))?1.5:1;
  const m=memory(records,spot.id,now),s=stats(records,spot.area);
  if(m.last&&!m.ready)return .01;
  return seed*topic*(s.maintenance?.35:1)*(m.last?.grade==='review'&&m.due?5:m.last?.grade==='reasonable'&&m.due?2:m.due?1:.2);
 }
 function pick(pool,records,imports,targeted,recent,random=Math.random) {
  if(!pool.length)return null;
  let candidates=pool.filter(s=>!recent.slice(-3).includes(s.id));
  if(!candidates.length)candidates=pool.filter(s=>s.id!==recent.at(-1));
  if(!candidates.length)candidates=pool;
  if(!targeted) {
   const general=candidates.filter(s=>s.sourceType!=='history');
   candidates=general.length?general:candidates;
   return candidates[Math.floor(random()*candidates.length)];
  }
  // Choose the replay/coaching bucket before weighting: adding hundreds of
  // histories must not crowd out scored practice. Roughly one third of targeted
  // slots are real-hand reflection when both pools are available.
  const real=candidates.filter(s=>s.sourceType==='history'),coached=candidates.filter(s=>s.sourceType!=='history');
  if(real.length&&coached.length)candidates=random()<1/3?real:coached;
  const weighted=candidates.map(s=>({s,w:s.sourceType==='history'&&records.some(r=>r.spotId===s.id)?.08:weight(s,records,imports)}));
  let point=random()*weighted.reduce((n,p)=>n+p.w,0);
  for(const p of weighted){point-=p.w;if(point<=0)return p.s;}
  return weighted.at(-1).s;
 }
 function mix(random=Math.random){const a=[true,true,true,true,true,true,true,false,false,false];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function variation(spot,random=Math.random) {
  const s=structuredClone(spot);
  if(['history','solver-model'].includes(s.sourceType))return s;
  const original=['s','h','d','c'],shuffled=[...original];
  for(let i=3;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  const map=Object.fromEntries(original.map((key,i)=>[key,shuffled[i]]));
  const names={s:'spade',h:'heart',d:'diamond',c:'club'};
  const wordMap=Object.fromEntries(original.map(key=>[names[key],names[map[key]]]));
  const remap=text=>String(text).replace(/\b(spade|heart|diamond|club)(s?)\b/g,(_,word,plural)=>wordMap[word]+plural);
  s.hole=s.hole.map(c=>c[0]+map[c[1]]);s.board=s.board.map(c=>c[0]+map[c[1]]);
  for(const key of ['why','heuristic','overlay'])if(s[key])s[key]=remap(s[key]);
  s.history=s.history.map(([street,line])=>[street,remap(line)]);
  s.suitMap=map;return s;
 }
 return {stats,level,memory,weight,pick,mix,variation};
})();
if(typeof module!=='undefined')module.exports=Practice;
