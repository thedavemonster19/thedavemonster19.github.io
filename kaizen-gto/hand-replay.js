'use strict';
const HandReplay = (() => {
 function available(hand) {
  return hand?.replay?.version===1 && hand.spots?.length>0 && hand.spots[0].board.length===0 &&
   hand.spots.every(s=>s.recordedChoice&&['fold','passive','aggressive'].includes(s.recordedChoice.action)) &&
   Array.isArray(hand.replay.terminal?.awards);
 }
 function start(hand) {
  if(!available(hand))throw new Error('This hand needs its complete original export before it can be replayed.');
  return {hand,index:0,choices:[],status:'playing'};
 }
 function current(run){return run.hand.spots[run.index];}
 function choose(run,action,amount,table) {
  if(run.status!=='playing')throw new Error('This replay has ended.');
  if(!['fold','passive','aggressive'].includes(action))throw new Error('Unknown action.');
  if(action==='fold'&&table.call<=0)throw new Error('Check is available.');
  if(action==='aggressive'&&(!table.canRaise||!Number.isFinite(amount)||amount<table.min-.001||amount>table.max+.001))throw new Error('Illegal bet or raise.');
  const spot=current(run),expected=spot.recordedChoice;
  const matched=action===expected.action&&(action!=='aggressive'||Math.abs(amount-expected.amount)<.005);
  const choice={spotId:spot.id,action,amount:action==='aggressive'?amount:null,original:spot.historicalAction,matched};
  run.choices.push(choice);
  if(action==='fold')run.status=matched?'complete':'folded';
  else if(!matched)run.status='diverged';
  else if(run.index+1===run.hand.spots.length)run.status='complete';
  else run.index++;
  return {status:run.status,choice};
 }
 // Readiness is derived from the current catalogue, never persisted as a grade.
 function netResult(hand){
  const end=hand?.replay?.terminal;
  return available(hand)&&Number.isFinite(end.heroWon)&&Number.isFinite(end.heroInvested)?Math.round((end.heroWon-end.heroInvested)*100)/100:null;
 }
 function pickReady(spots,hands,records,recent=[]){
  const losses=new Map(hands.map(h=>[h.id,Math.max(0,-(netResult(h)??0))]));
  const seen=new Set(records.filter(r=>r.strategy?.coverage==='covered').map(r=>r.spotId));
  const fresh=spots.filter(s=>!recent.slice(-3).includes(s.id)),pool=fresh.length?fresh:spots;
  return [...pool].sort((a,b)=>Number(seen.has(a.id))-Number(seen.has(b.id))||(losses.get(b.handId)||0)-(losses.get(a.handId)||0))[0]||null;
 }
 function coverage(hands,catalogue,tableEngine,review){
  const ready=[],waiting=[],byHand=[];
  for(const hand of hands){
   let count=0;
   for(const spot of hand.spots||[]){
    let reason='No exact solution';
    try{
     const table=tableEngine.state(spot),context=review.context(spot),found=catalogue.match(spot,table,context);
     if(found){
      const actions=found.node.actions;
      const complete=(actions.some(a=>a.type===(table.call?'call':'check'))||found.node.unavailableActions?.includes('call'))&&(!table.call||actions.some(a=>a.type==='fold'));
      const confident=complete&&actions.every(a=>catalogue.evaluate(spot,table,context,a.type==='fold'?'fold':['call','check'].includes(a.type)?'passive':'aggressive',a.amountBB)?.coverage==='covered');
      if(confident){ready.push(spot);count++;continue;}
      reason='Solution needs validation';
     }else if(!spot.board.length)reason='Preflop solution needed';
     else if(table.active.size>2)reason='Multiway solution needed';
    }catch{reason='Hand state needs review';}
    waiting.push({handId:hand.id,spotId:spot.id,reason});
   }
   byHand.push({id:hand.id,ready:count,total:(hand.spots||[]).length,netBB:netResult(hand)});
  }
  return {ready,waiting,byHand};
 }
 return {available,start,current,choose,coverage,netResult,pickReady};

})();
if(typeof module!=='undefined')module.exports=HandReplay;
