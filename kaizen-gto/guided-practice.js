'use strict';
// Learning selection changes which reference decision is dealt, never its solution.
const GuidedPractice=(()=>{
 const topics={preflop:'Preflop foundations',value:'Value & protection',draws:'Draws & pressure',texture:'Checking & defending',river:'River value & bluffs'};
 const pressureTopics={'preflop-defense':'Defending an open','preflop-reraise':'Facing a preflop reraise','preflop-jam':'Facing a preflop all-in',checkraise:'Responding to a check-raise',raise:'Responding to a raise',overbet:'Facing an overbet',jam:'Facing a river all-in',bet:'Defending against a bet'};
 // Classify only information already visible at the table, never the answer.
 function pressure(spot,table){
  if(!table.call)return '';
  if(!spot.board.length){
   if(table.highest<=1)return '';
   if(table.call===table.remaining)return 'preflop-jam';
   return (spot.history[0][1].match(/: raises/g)||[]).length>=2?'preflop-reraise':'preflop-defense';
  }
  if(table.heroStreet)return /: checks/.test(spot.history.at(-1)[1])?'checkraise':'raise';
  if(table.call===table.remaining)return 'jam';
  return table.call>table.pot-table.call?'overbet':'bet';
 }
 function impact(result){
  if(result.coverage!=='covered')return {key:'unscored',label:'No EV grade'};
  if(result.lossBB<=result.evToleranceBB)return {key:'low',label:'Low EV loss'};
  if(result.lossBB<.5)return {key:'small',label:'Small EV difference'};
  if(result.lossBB<2)return {key:'review',label:'Worth reviewing'};
  return {key:'costly',label:'Costly decision'};
 }
 function lesson(record){const s=record.strategy.state;return pressureTopics[pressure(s,s.table)]||topics[record.area]||'Range decisions';}
 function sets(records){
  const groups=new Map();
  for(const r of records){const m=r.practiceSet;if(m?.version!==1||typeof m.id!=='string'||!m.id||!Number.isInteger(m.slot)||m.slot<1||m.slot>10||typeof m.counted!=='boolean')continue;
   if(!groups.has(m.id))groups.set(m.id,{id:m.id,records:[],retries:0});
   const group=groups.get(m.id);if(m.counted){if(!group.records.some(x=>x.practiceSet.slot===m.slot))group.records.push(r);}else group.retries++;
  }
  return [...groups.values()].map(g=>({...g,records:g.records.sort((a,b)=>a.practiceSet.slot-b.practiceSet.slot)})).filter(g=>g.records.every((r,i)=>r.practiceSet.slot===i+1));
 }
 function describe(spot,table,coach){
  if(!spot.board.length)return {area:'preflop',prompt:table.highest>1?'Which hands continue against this raise, at this price and position?':'How do your position and the players still to act affect this starting hand?'};
  const facts=coach.handFacts({hole:spot.hole,board:spot.board});
  if(spot.board.length===5)return {area:'river',prompt:table.call?'What value hands and bluffs can reach this river?':'What worse hands call a bet, or what better hands fold?'};
  if(facts.draw)return {area:'draws',prompt:'What equity do you keep when called, and what hands can you make fold?'};
  if(facts.sharedPair||facts.pairBelowBoard)return {area:'texture',prompt:'What strength do your hole cards add beyond the pair on the board?'};
  if(table.call)return {area:'texture',prompt:'What is the price of calling, and how strong is the betting range?'};
  if(facts.rank[0]>=2||facts.made==='an overpair'||facts.made.startsWith('top pair'))return {area:'value',prompt:'What worse hands pay you? What do you gain or give up by checking?'};
  return {area:'texture',prompt:'Does betting earn value or useful folds, or is checking more valuable?'};
 }
 function prepare(catalogue,tableEngine,review,coach){
  return catalogue.practiceSpots().filter(spot=>{
   const table=tableEngine.state(spot),context=review.context(spot),found=catalogue.match(spot,table,context);
   if(!found)return false;
   const actions=found.node.actions;
   // Every offered action must have an EV grade. Keep uncertain nodes out of
   // the guided pool without changing their data or their validation rules.
   return (actions.some(a=>a.type===(table.call?'call':'check'))||found.node.unavailableActions?.includes('call'))&&(!table.call||actions.some(a=>a.type==='fold'))&&actions.every(a=>{
    const code=a.type==='fold'?'fold':['check','call'].includes(a.type)?'passive':'aggressive';
    return catalogue.evaluate(spot,table,context,code,a.amountBB)?.coverage==='covered';
   });
  }).map(spot=>({...spot,...describe(spot,tableEngine.state(spot),coach),pressureKind:pressure(spot,tableEngine.state(spot))}));
 }
 function verified(records,catalogue){return records.filter(r=>r.sourceType==='solver-practice'&&r.strategy?.coverage==='covered'&&catalogue.validRecord(r));}
 const day=24*60*60*1000;
 function attempt(spot,records,forced=false,now=Date.now()){
  const previous=records.findLastIndex(r=>r.spotId===spot.id);
  if(previous<0)return {version:1,kind:'first'};
  const last=records[previous],delayed=now-Date.parse(last.time)>=day&&records.slice(previous+1).filter(r=>r.spotId!==spot.id).length>=3;
  return {version:1,kind:forced?'retry':delayed?'retest':'repeat',previousId:last.id};
 }
 function firstAttempts(records){
  const seen=new Set();
  return records.filter(r=>{const first=!seen.has(r.spotId);seen.add(r.spotId);return first&&(!r.practiceAttempt||r.practiceAttempt.kind==='first');});
 }
 function mistakes(records,pool,now=Date.now()){
  const ids=new Set(pool.map(s=>s.id)),unresolved=new Map(),last=new Map();
  records.forEach((r,i)=>{
   if(!ids.has(r.spotId))return;
   const previous=last.get(r.spotId),due=previous&&Date.parse(r.time)-Date.parse(previous.record.time)>=day&&records.slice(previous.index+1,i).filter(x=>x.spotId!==r.spotId).length>=3;
   if(r.grade==='review')unresolved.set(r.spotId,r);
   // Only an uncued, delayed check can close a mistake. Legacy/retry grades
   // stay useful practice records without asserting that retention was tested.
   else if(r.grade==='good'&&r.practiceAttempt?.kind==='retest'&&due)unresolved.delete(r.spotId);
   last.set(r.spotId,{record:r,index:i});
  });
  return [...unresolved.values()].map(r=>{const latest=last.get(r.spotId),dueAt=Date.parse(latest.record.time)+day;return {...r,dueAt,due:now>=dueAt&&records.slice(latest.index+1).filter(x=>x.spotId!==r.spotId).length>=3};});
 }
 function pick(pool,records,recent,review,random=Math.random){
  if(!pool.length)return null;
  const missing=mistakes(records,pool).filter(r=>r.due&&!recent.slice(-3).includes(r.spotId));
  // Retest after a day and intervening decisions; immediate retries stay separate.
  if(missing.length&&records.length%3===0){
   missing.sort((a,b)=>b.strategy.lossBB-a.strategy.lossBB);
   return pool.find(s=>s.id===missing[0].spotId);
  }
  const lookup=new Map(pool.map(s=>[s.id,s])),last=recent.map(id=>lookup.get(id)).filter(Boolean);
  // Alternate pressure and initiative when both exist. Within pressure, rotate
  // public situations (raises, overbets, all-ins), without selecting for folds.
  const pressurePool=pool.filter(s=>s.pressureKind),openPool=pool.filter(s=>!s.pressureKind);
  const defend=last.at(-1)?.pressureKind?false:true;
  const candidates=(defend?pressurePool:openPool).length?(defend?pressurePool:openPool):pool;
  const key=s=>defend&&pressurePool.length?s.pressureKind:s.area;
  const areas=[...new Set(candidates.map(key))],counts=areas.map(area=>last.slice(-16).filter(s=>key(s)===area).length),min=Math.min(...counts);
  const choices=areas.filter((area,i)=>counts[i]===min),area=choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
  const seen=new Set(records.map(r=>r.spotId)),topicPool=candidates.filter(s=>key(s)===area);
  const fresh=topicPool.filter(s=>!seen.has(s.id));
  return review.pickPractice(fresh.length?fresh:topicPool,recent,random);
 }
 function summary(records){
  const good=records.filter(r=>r.grade==='good').length,loss=records.reduce((n,r)=>n+r.strategy.lossBB,0);
  const recent=records.slice(-10),recentLoss=recent.reduce((n,r)=>n+r.strategy.lossBB,0);
  const first=firstAttempts(records),retests=records.filter(r=>r.practiceAttempt?.kind==='retest'),firstLoss=first.reduce((n,r)=>n+r.strategy.lossBB,0);
  return {count:records.length,good,loss,average:records.length?loss/records.length:0,recentCount:recent.length,recentGood:recent.filter(r=>r.grade==='good').length,recentAverage:recent.length?recentLoss/recent.length:0,
   firstCount:first.length,firstGood:first.filter(r=>r.grade==='good').length,firstAverage:first.length?firstLoss/first.length:0,retryCount:records.length-first.length-retests.length,retestCount:retests.length,retestGood:retests.filter(r=>r.grade==='good').length};
 }
 return {topics,pressureTopics,pressure,impact,lesson,sets,prepare,verified,mistakes,pick,summary,attempt,firstAttempts};
})();
if(typeof module!=='undefined')module.exports=GuidedPractice;
