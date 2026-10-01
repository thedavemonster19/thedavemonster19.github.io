'use strict';
// Only the shipped, independently checked pack can confer a solved-model grade.
const SolverGrades=(()=>{
 const pack=SOLVER_PACK,tolerance=1e-8;
 const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 if(pack.certificate.nashGapBB>tolerance||pack.provenance.primalStatus||pack.provenance.dualStatus)throw Error('Unverified solver pack');
 for(const n of pack.nodes){
  if(Math.abs(n.actions.reduce((s,a)=>s+a.frequency,0)-1)>1e-6||n.actions.some(a=>!Number.isFinite(a.evBB)||!Number.isFinite(a.frequency)||a.frequency<0||a.frequency>1))throw Error('Invalid solver actions');
 }
 function node(spot){
  const n=pack.nodes.find(n=>n.spot.id===spot.id);if(!n||spot.sourceType!=='solver-model')return null;
  const keys=['profile','hero','villain','hole','board','bb','smallBlind','stack','pot','bet','history','tableSnapshot'];
  return keys.every(k=>exact(n.spot[k],spot[k]))?n:null;
 }
 function evaluate(spot,code,amount=0){
  const n=node(spot),a=n?.actions.find(a=>a.code===code&&(code!=='aggressive'||Math.abs(a.amount-amount)<1e-8));
  const result={grade:'unscored',coverage:n?'off-tree':'unmatched',packId:pack.id,nodeId:n?.id||null,sourceSHA256:pack.provenance.sourceSHA256,
   action:code,amount:code==='aggressive'?amount:0,frequency:null,evBB:null,bestEVBB:null,lossBB:null,potFraction:null,actions:n?structuredClone(n.actions):[],nashGapBB:pack.certificate.nashGapBB};
  if(!a)return result;
  const best=Math.max(...n.actions.map(a=>a.evBB)),loss=Math.max(0,best-a.evBB);
  return {...result,grade:loss<=tolerance?'good':'review',coverage:'solved-model',frequency:a.frequency,evBB:a.evBB,bestEVBB:best,lossBB:loss,potFraction:loss/spot.tableSnapshot.pot};
 }
 function validRecord(r){
  const s=pack.nodes.find(n=>n.spot.id===r.spotId)?.spot;
  return !!s&&r.mode==='solved'&&r.sourceType==='solver-model'&&r.hole===s.hole.join(' ')&&r.board===s.board.join(' ')&&r.profile===s.profile&&r.area===s.area&&
   ['fold','passive','aggressive'].includes(r.solution?.action)&&Number.isFinite(r.solution?.amount)&&
   exact(evaluate(s,r.solution.action,r.solution.amount),r.solution)&&r.grade===r.solution.grade;
 }
 function summary(records){
  const verified=records.filter(r=>validRecord(r)&&r.solution.coverage==='solved-model');
  return {count:verified.length,lossBB:verified.reduce((n,r)=>n+r.solution.lossBB,0),
   nodes:pack.nodes.map(n=>{const rows=verified.filter(r=>r.solution.nodeId===n.id);return {id:n.id,label:n.spot.hole.join(' ')+' · '+n.spot.hero,count:rows.length,
    actions:n.actions.map(a=>({label:a.label,target:a.frequency,observed:rows.length?rows.filter(r=>r.solution.action===a.code&&(a.code!=='aggressive'||r.solution.amount===a.amount)).length/rows.length:null}))};})};
 }
 return {pack,node,evaluate,validRecord,summary};
})();
const SOLVED_SPOTS=SOLVER_PACK.nodes.map(n=>structuredClone(n.spot));
