'use strict';
// Backups are user data, never executable JavaScript or solver evidence.
const PracticeBackup=(()=>{
 const areas=['value','draws','preflop','texture','river'];
 const positions=['SB','BB','UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN'];
 const check=(ok,message)=>{if(!ok)throw new Error('Invalid backup: '+message);};
 const text=(v,max=100000)=>typeof v==='string'&&v.length<=max;
 const number=v=>Number.isFinite(v)&&v>=0&&v<=1e9;
 const cards=v=>Array.isArray(v)&&v.length<=5&&v.every(c=>typeof c==='string'&&/^[2-9TJQKA][shdc]$/.test(c))&&new Set(v).size===v.length;
 function tree(v,depth=0){
  check(depth<25,'too deeply nested');
  if(v===null||typeof v==='boolean')return;
  if(typeof v==='string'){check(text(v),'text too long');return;}
  if(typeof v==='number'){check(Number.isFinite(v),'non-finite number');return;}
  check(v&&typeof v==='object','unexpected value');
  check(Object.keys(v).length<=20000,'too many values');
  for(const [key,value]of Object.entries(v)){check(!['__proto__','constructor','prototype'].includes(key),'unsafe property');tree(value,depth+1);}
 }
 function history(v){check(Array.isArray(v)&&v.length>0&&v.length<=8&&v.every(row=>Array.isArray(row)&&row.length===2&&row.every(x=>text(x))),'hand history');}
 function seats(v){
  check(Array.isArray(v)&&v.length>=2&&v.length<=9,'seats');
  check(new Set(v.map(p=>p.position)).size===v.length,'duplicate seats');
  for(const p of v)check(positions.includes(p.position)&&typeof p.hero==='boolean'&&typeof p.active==='boolean'&&number(p.street)&&number(p.remaining),'seat');
 }
 function spot(s,kind){
  check(s&&text(s.id,100)&&['online','live'].includes(s.profile)&&areas.includes(s.area)&&[1,2,3].includes(s.level),'spot identity');
  check(positions.includes(s.hero)&&text(s.villain,100),'position');
  check(cards(s.hole)&&s.hole.length===2&&cards(s.board)&&[0,3,4,5].includes(s.board.length)&&new Set([...s.hole,...s.board]).size===s.hole.length+s.board.length,'cards');
  check(number(s.stack)&&number(s.pot)&&number(s.bet),'pot or stack');
  for(const key of ['bb','smallBlind','currentPot','call'])if(s[key]!==undefined)check(number(s[key])&&(key!=='bb'||s[key]>0),key);
  history(s.history);check(text(s.why)&&text(s.heuristic),'explanation');
  for(const key of ['overlay','historicalAction','sourceName','sourceDate','handId'])if(s[key]!==undefined)check(text(s[key]),'spot '+key);
  check(Array.isArray(s.options)&&s.options.length<=10&&s.options.every(x=>text(x,500))&&Array.isArray(s.okay)&&s.okay.every(i=>Number.isInteger(i)&&i>=0&&i<s.options.length),'coaching options');
  if(kind==='hand')check(s.sourceType==='history'&&s.best===-1&&s.options.length===0,'historical hands must be unscored');
  else check(s.sourceType!=='history'&&Number.isInteger(s.best)&&s.best>=0&&s.best<s.options.length,'authored coaching');
  const t=s.tableSnapshot;check(t&&typeof t.preflop==='boolean'&&typeof t.canRaise==='boolean'&&['Bet','Raise to'].includes(t.verb),'table snapshot');
  check(text(t.read),'table read');
  for(const key of ['order','active'])check(Array.isArray(t[key])&&t[key].every(p=>positions.includes(p))&&new Set(t[key]).size===t[key].length,'table positions');
  check(t.order.includes(s.hero)&&t.active.includes(s.hero),'active hero');
  for(const key of ['highest','heroStreet','remaining','call','pot','min','max','committed'])check(number(t[key]),'table '+key);
  check(t.min<=t.max&&t.call<=t.remaining+.01,'action bounds');seats(t.seats);
  check(t.seats.length===t.order.length&&t.seats.every(p=>t.order.includes(p.position))&&t.seats.filter(p=>p.hero).length===1&&t.seats.find(p=>p.hero).position===s.hero,'seat order');
  if(s.recordedChoice)check(['fold','passive','aggressive'].includes(s.recordedChoice.action)&&(s.recordedChoice.action!=='aggressive'||number(s.recordedChoice.amount)),'recorded action');
 }
 function item(i){
  check(i&&text(i.id,100)&&i.id.length>0&&text(i.name,250),'import identity');
  check(['hand','report','drill-pack'].includes(i.kind),'import type');
  if(i.kind==='report'){check(text(i.text,50000)&&text(i.summary)&&Array.isArray(i.themes)&&i.themes.every(t=>areas.includes(t)),'report');return;}
  check(Array.isArray(i.spots)&&i.spots.length>0&&i.spots.length<=100,'practice decisions');
  i.spots.forEach(s=>spot(s,i.kind));
  if(i.kind==='hand'){
   const first=i.spots[0];
   check(i.spots.every(s=>s.handId===i.id&&text(s.historicalAction)&&s.hero===first.hero&&JSON.stringify(s.tableSnapshot.order)===JSON.stringify(first.tableSnapshot.order))&&text(i.date),'hand identity');
  }
  if(!i.replay)return;
  const end=i.replay.terminal;check(i.kind==='hand'&&i.replay.version===1&&end&&i.spots[0].board.length===0&&i.spots.every(s=>s.recordedChoice),'full replay');
  check(cards(end.board)&&[0,3,4,5].includes(end.board.length),'final board');history(end.history);seats(end.seats);
  const first=i.spots[0];
  check(end.seats.length===first.tableSnapshot.order.length&&end.seats.every(p=>first.tableSnapshot.order.includes(p.position))&&end.seats.filter(p=>p.hero).length===1&&end.seats.find(p=>p.hero).position===first.hero,'terminal seats');
  for(const key of ['pot','charges','heroInvested','heroWon'])check(number(end[key]),'settlement '+key);
  check(Array.isArray(end.awards)&&end.awards.length>0&&end.awards.every(a=>positions.includes(a.position)&&number(a.amount)),'awards');
  check(end.reveals&&Object.entries(end.reveals).every(([p,c])=>positions.includes(p)&&cards(c)&&c.length===2),'revealed cards');
 }
 function validate(data){
  tree(data);check(data?.format==='kaizen-gto-backup'&&data.version===1,'format or version');
  check(Array.isArray(data.records)&&Array.isArray(data.imports),'records and imports');
  for(const r of data.records){
   check(text(r.id,100)&&r.id.length>0&&text(r.spotId,100)&&['online','live'].includes(r.profile)&&areas.includes(r.area),'decision identity');
   check(['good','reasonable','review','unscored'].includes(r.grade)&&text(r.time,100)&&Number.isFinite(Date.parse(r.time))&&number(r.seconds),'decision grade or time');
   for(const key of ['choice','hole','board','preferred','why','heuristic'])check(text(r[key]),'decision '+key);
   if(r.practiceAttempt)check(r.sourceType==='solver-practice'&&r.practiceAttempt.version===1&&['first','retry','repeat','retest'].includes(r.practiceAttempt.kind)&&(r.practiceAttempt.kind==='first'||text(r.practiceAttempt.previousId,100)),'practice attempt');
   if(r.practiceSet)check(r.sourceType==='solver-practice'&&r.practiceSet.version===1&&text(r.practiceSet.id,100)&&r.practiceSet.id.length>0&&Number.isInteger(r.practiceSet.slot)&&r.practiceSet.slot>=1&&r.practiceSet.slot<=10&&typeof r.practiceSet.counted==='boolean','practice set');
   if(r.decisionState){
    check(typeof StrategyReview!=='undefined','decision-state validator missing');StrategyReview.validateState(r.decisionState);
    check(r.decisionState.profile===r.profile&&r.decisionState.hole.join(' ')===r.hole.split(' ').sort().join(' ')&&r.decisionState.board.join(' ')===r.board,'decision-state identity');
   }
   if(r.mode==='solved'||r.sourceType==='solver-model')check(typeof SolverGrades!=='undefined'&&SolverGrades.validRecord(r),'solver record must reproduce its verified solution');
   if(r.strategy)check(typeof strategyCatalogue!=='undefined'&&strategyCatalogue.validRecord(r),'strategy record must reproduce its source export');
   if(r.mode==='simulation'||r.sourceType==='simulation'){
    check((r.grade==='unscored'||r.strategy)&&r.mode==='simulation'&&r.sourceType==='simulation','simulation grade needs a strategy export');
    check(text(r.handId,100)&&Number.isInteger(r.branchIndex)&&r.branchIndex>=0&&r.branchIndex<100,'simulation branch');
    check(Number.isInteger(r.simulationSeed)&&r.simulationSeed>=0&&r.simulationSeed<=4294967295&&Number.isInteger(r.simulationVersion)&&text(r.simulationPolicy,100),'simulation provenance');
   }
  }
  data.imports.forEach(item);
  check(new Set(data.records.map(r=>r.id)).size===data.records.length&&new Set(data.imports.map(i=>i.id)).size===data.imports.length,'duplicate identifiers');
  return data;
 }
 return {validate};
})();
if(typeof module!=='undefined')module.exports=PracticeBackup;
