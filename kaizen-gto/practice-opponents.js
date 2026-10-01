'use strict';
// Deliberately simple authored practice policy, not GTO or a model of the original opponents.
const PracticeOpponents=(()=>{
 const id='practice-heuristic-v1';
 function choose(view,random=Math.random){
  const l=view.legal,players=view.players.filter(p=>p.active).length;
  let strength=PokerSim.preflopStrength(view.hole),draw=false;
  if(view.board.length){
   const all=[...view.hole,...view.board],rank=PokerSim.rank(all),values=view.hole.map(c=>'23456789TJQKA'.indexOf(c[0]));
   const boardHigh=Math.max(...view.board.map(c=>'23456789TJQKA'.indexOf(c[0])));
   const pairsBoard=view.hole.some(c=>view.board.some(b=>b[0]===c[0]));
   strength=rank[0]>=4?.94:rank[0]===3?.83:rank[0]===2?.73:rank[0]===1?(pairsBoard&&Math.max(...values)>=boardHigh?.68:.45):.12;
   draw=view.board.length<5&&'shdc'.split('').some(s=>view.hole.some(c=>c[1]===s)&&all.filter(c=>c[1]===s).length===4);
   if(draw)strength=Math.max(strength,.48);
  }
  const raise=()=>({action:'aggressive',amount:Math.round(Math.min(l.max,Math.max(l.min,!view.board.length?Math.max(2.5,view.highest*3):view.highest?view.highest+Math.max(view.pot*.7,view.highest):view.pot*.55))*100)/100});
  if(!l.call){if(l.canRaise&&(strength>.63||random()<(draw?.3:.12)/Math.max(1,players-1)))return raise();return {action:'passive'};}
  const price=l.call/(view.pot+l.call),pressure=Math.min(.25,l.call/Math.max(1,view.remaining)*.25);
  if(l.canRaise&&strength>(view.board.length?.84:.9)&&random()<.65)return raise();
  if(strength>=.28+price*.65+pressure||random()<.035)return {action:'passive'};
  return {action:'fold'};
 }
 return {id,label:'Authored practice opponents · not GTO',choose};
})();
if(typeof module!=='undefined')module.exports=PracticeOpponents;
