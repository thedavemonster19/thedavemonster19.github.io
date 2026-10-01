'use strict';
// Summarize only the already-reached public action log. Preserve unfamiliar
// prose verbatim instead of guessing missing positions or amounts.
const HandContext=(()=>{
 function compact(street,line){
  const parts=line.split(' · '),parsed=parts.map(part=>part.match(/^(You|SB|BB|UTG(?:\+\d)?|LJ|HJ|CO|BTN): (.+)$/));
  if(!parsed.every(Boolean))return line;
  let raises=0;
  const actions=parsed.map(([,who,action])=>{
   if(/^posts /.test(action))return null;
   if(action==='folds')return street==='Preflop'?null:who+' fold';
   if(action==='checks')return who+' check';
   let m=action.match(/^raises ([\d.]+)bb to ([\d.]+)bb(.*)$/);
   if(m){raises++;return who+' '+(street==='Preflop'&&raises>1?(raises+1)+'-bet to ':'raise to ')+m[2]+'bb'+m[3];}
   m=action.match(/^(calls|bets) ([\d.]+)bb(.*)$/);
   if(m)return who+' '+(m[1]==='calls'?'call ':'bet ')+m[2]+'bb'+m[3];
   return who+': '+action;
  }).filter(Boolean);
  return actions.length?actions.join(' → '):line;
 }
 // Reconstruct only explicit public amounts, anchored to the authoritative pot.
 // Raise totals replace a player's street contribution; calls add chips.
 function streetAmounts(line){
  const paid={};let delta=0,wager=null;
  for(const part of line.split(' · ').filter(Boolean)){
   if(part==='Action on you.')continue;
   let m=part.match(/^([\d.]+)bb (?:uncalled )?returned to (.+)$/);
   if(m){delta-=Number(m[1]);continue;}
   m=part.match(/^(You|SB|BB|UTG(?:\+\d)?|LJ|HJ|CO|BTN): (.+)$/);
   if(!m)return null;
   const [,who,action]=m;
   if(/^(checks|folds)$/.test(action))continue;
   const raise=action.match(/^raises (?:[\d.]+bb )?to ([\d.]+)bb(?:.*)$/);
   const add=action.match(/^(?:calls|bets|posts (?:small|big) blind) ([\d.]+)bb(?:.*)$/);
   if(!raise&&!add)return null;
   const chips=raise?Number(raise[1])-(paid[who]||0):Number(add[1]);
   if(chips<0)return null;
   if(raise||action.startsWith('bets'))wager={paid:chips,before:delta,raise:!!raise};
   delta+=chips;paid[who]=(paid[who]||0)+chips;
  }
  return {delta,wager};
 }
 function rows(history,currentPot){
  const result=history.map(([street,line])=>({street,text:compact(street,line),full:line,pot:null,startPot:null,wager:null}));
  let end=Number.isFinite(currentPot)?currentPot:null;
  for(let i=result.length-1;i>=0;i--){
   const row=result[i],amounts=streetAmounts(row.full);row.pot=end;
   const start=end!==null&&amounts?Math.round((end-amounts.delta)*100)/100:null;
   row.startPot=start!==null&&start>=0?start:null;
   if(row.startPot!==null&&amounts.wager)row.wager={...amounts.wager,potBefore:row.startPot+amounts.wager.before};
   end=row.startPot;
  }
  return result;
 }
 return {compact,rows};
})();
if(typeof module!=='undefined')module.exports=HandContext;
