'use strict';
// Normalized, versioned solver exports. This module evaluates supplied solutions;
// it never generates frequencies, estimates a missing EV, or matches a nearby size.
const StrategyReview=(()=>{
 const positions=['SB','BB','UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN'];
 const types=['fold','check','call','bet','raise'];
 const money=v=>Number.isFinite(v)&&v>=0&&v<=1e7&&Math.abs(v*100-Math.round(v*100))<1e-6;
 const str=(v,max=500)=>typeof v==='string'&&v.length>0&&v.length<=max;
 const fail=(ok,message)=>{if(!ok)throw Error('Invalid strategy export: '+message);};
 const same=(a,b)=>stable(a)===stable(b);
 const clone=v=>JSON.parse(JSON.stringify(v));
 function stable(v){
  if(v===null||typeof v!=='object')return JSON.stringify(v);
  return Array.isArray(v)?'['+v.map(stable).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
 }
 function cards(a,n){return Array.isArray(a)&&n.includes(a.length)&&a.every(c=>/^[2-9TJQKA][shdc]$/.test(c))&&new Set(a).size===a.length;}
 function context(spot,simulation=null){
  if(spot.sourceType==='simulation')return simulation?{kind:'simulation',handId:simulation.handId,branchIndex:simulation.branchIndex,seed:simulation.simulationSeed,engine:simulation.simulationVersion,policy:simulation.simulationPolicy}:null;
  return spot.sourceType==='history'?{kind:'hand',handId:spot.handId}:{kind:'drill',spotId:spot.id};
 }
 function state(spot,table){
  if(!table)throw Error('A public table state is required.');
  return {profile:spot.profile,hero:spot.hero,hole:[...spot.hole].sort(),board:[...spot.board],startingStackBB:spot.stack,
   bigBlind:spot.bb??(spot.profile==='live'?3:.5),smallBlind:spot.smallBlind??(spot.profile==='live'?1:(spot.bb??.5)/2),
   history:spot.history.map(([street,line])=>[street,line||'Action on you.']),table:{preflop:table.preflop,order:[...table.order],active:[...table.active],
    highest:table.highest,heroStreet:table.heroStreet,remaining:table.remaining,call:table.call,pot:table.pot,min:table.min,max:table.max,committed:table.committed,canRaise:table.canRaise,verb:table.verb,
    seats:table.order.map(position=>{const p=table.seats.find(p=>p.position===position);return {position,hero:p.hero,active:p.active,street:p.street,remaining:p.remaining};})}};
 }
 function validateState(s){
  fail(s&&['online','live'].includes(s.profile)&&positions.includes(s.hero),'profile/hero');
  fail(cards(s.hole,[2])&&cards(s.board,[0,3,4,5])&&new Set([...s.hole,...s.board]).size===s.hole.length+s.board.length,'cards');
  fail(same(s.hole,[...s.hole].sort()),'hole cards must be canonical');
  fail(money(s.startingStackBB)&&money(s.bigBlind)&&s.bigBlind>0&&money(s.smallBlind)&&s.smallBlind>0&&s.smallBlind<s.bigBlind,'stakes/stacks');
  const streets=['Preflop','Flop','Turn','River'].slice(0,s.board.length===0?1:s.board.length-1);
  fail(Array.isArray(s.history)&&s.history.length===streets.length&&s.history.every((h,i)=>Array.isArray(h)&&h.length===2&&h[0]===streets[i]&&str(h[1],5000)),'reached history');
  const t=s.table;
  fail(t&&typeof t.preflop==='boolean'&&t.preflop===(s.board.length===0)&&typeof t.canRaise==='boolean','street/raise state');
  fail(Array.isArray(t.order)&&t.order.length>=2&&t.order.length<=9&&t.order.every(p=>positions.includes(p))&&new Set(t.order).size===t.order.length,'seat order');
  fail(Array.isArray(t.active)&&t.active.includes(s.hero)&&t.active.every(p=>t.order.includes(p))&&new Set(t.active).size===t.active.length,'active seats');
  fail(Array.isArray(t.seats)&&t.seats.length===t.order.length&&t.seats.every((p,i)=>p.position===t.order[i]&&typeof p.active==='boolean'&&typeof p.hero==='boolean'&&p.hero===(p.position===s.hero)&&p.active===t.active.includes(p.position)&&money(p.street)&&money(p.remaining)),'seats');
  for(const k of ['highest','heroStreet','remaining','call','pot','min','max','committed'])fail(money(t[k]),'table '+k);
  const h=t.seats.find(p=>p.hero),eps=1e-6;
  fail(Math.abs(t.highest-Math.max(...t.seats.map(p=>p.street)))<eps&&t.highest>=t.heroStreet,'highest wager');
  fail(h.street===t.heroStreet&&h.remaining===t.remaining&&Math.abs(t.max-t.heroStreet-t.remaining)<eps,'hero stack');
  fail(Math.abs(t.call-Math.min(t.remaining,t.highest-t.heroStreet))<eps&&t.min<=t.max&&t.pot>0,'call/pot/bounds');
  fail(t.verb===(t.highest?'Raise to':'Bet')&&(!t.canRaise||t.max>t.highest),'raise definition');
  return s;
 }
 function validateContext(c){
  fail(c&&['hand','drill','simulation'].includes(c.kind),'context');
  if(c.kind==='drill')fail(str(c.spotId,100),'drill identity');
  else fail(str(c.handId,100),'hand identity');
  if(c.kind==='simulation')fail(Number.isInteger(c.branchIndex)&&c.branchIndex>=0&&Number.isInteger(c.seed)&&c.seed>=0&&c.seed<=4294967295&&Number.isInteger(c.engine)&&c.engine>0&&str(c.policy,100),'simulation context');
 }
 function action(spot,table,code,amount=0){
  if(code==='fold')return {type:'fold',amountBB:0};
  if(code==='passive')return {type:table.call?'call':'check',amountBB:table.call};
  if(code==='aggressive')return {type:table.highest?'raise':'bet',amountBB:amount};
  return null;
 }
 function legal(a,t){
  if(!a||!types.includes(a.type)||!money(a.amountBB))return false;
  if(a.type==='fold')return t.call>0&&a.amountBB===0;
  if(a.type==='check')return t.call===0&&a.amountBB===0;
  if(a.type==='call')return t.call>0&&a.amountBB===t.call;
  return t.canRaise&&a.type===(t.highest?'raise':'bet')&&a.amountBB>=t.min&&a.amountBB<=t.max;
 }
 function validatePack(pack,{allowFixtures=false}={}){
  fail(pack?.format==='kaizen-gto-strategies'&&pack.version===1&&str(pack.id,100)&&str(pack.name,150)&&typeof pack.active==='boolean','identity/version');
  const p=pack.provenance;
  fail(p&&str(p.engine,150)&&str(p.engineVersion,100)&&str(p.reference,2000)&&/^[a-f0-9]{64}$/.test(p.sourceSHA256),'source provenance');
  const reference=p.review==='reviewed-reference';
  fail(p.review==='reviewed-export'||reference||(allowFixtures&&p.review==='test-fixture'),'unreviewed export');
  if(reference)fail(p.engine==='PokerData'&&p.engineVersion==='NLHE v2'&&p.evBasis==='hand-start'&&p.precisionBB===.005,'reference source/EV convention');
  fail(str(p.gameAssumptions,8000)&&str(p.rangeSource,2000)&&str(p.rake,1000)&&str(p.tree,2000),'game/range/rake/tree assumptions');
  fail(Array.isArray(pack.nodes)&&pack.nodes.length>0&&pack.nodes.length<=20000,'decision nodes');
  const ids=new Set(),states=new Set();
  for(const n of pack.nodes){
   fail(n.practice===undefined||typeof n.practice==='boolean','practice marker');
   fail(n.practiceLabel===undefined||str(n.practiceLabel,150),'practice label');
   fail(!n.practice||n.context?.kind==='drill','practice context');
   fail(str(n.id,100)&&!ids.has(n.id),'duplicate node');ids.add(n.id);
   validateContext(n.context);validateState(n.state);
   const key=stable([n.context,n.state]);fail(!states.has(key),'ambiguous state');states.add(key);
   fail(str(n.solverNode,1000)&&str(n.rangeReference,2000)&&str(n.explanation,4000),'node provenance/explanation');
   fail(n.convergence&&str(n.convergence.metric,100)&&(reference?n.convergence.metric==='not reported'&&n.convergence.valueBB===null&&n.state.table.preflop:Number.isFinite(n.convergence.valueBB)&&n.convergence.valueBB>=0)&&Number.isFinite(n.evToleranceBB)&&n.evToleranceBB>=0&&n.evToleranceBB<=1,'convergence/EV tolerance');
   fail(Array.isArray(n.actions)&&n.actions.length>=1&&n.actions.length<=20,'actions');
   const keys=new Set();
   for(const a of n.actions){
    fail(legal(a,n.state.table),'illegal '+a.type);
    fail(Number.isFinite(a.frequency)&&a.frequency>=0&&a.frequency<=1&&Number.isFinite(a.evBB)&&Math.abs(a.evBB)<=1e9,'frequency/EV');
    const key=stable([a.type,a.amountBB]);fail(!keys.has(key),'duplicate action');keys.add(key);
   }
   fail(Math.abs(n.actions.reduce((s,a)=>s+a.frequency,0)-1)<=1e-6,'frequencies must sum to one');
   const basic=n.state.table.call?['fold','call']:['check'];
   // Some preflop source trees offer raise-or-fold before any voluntary wager.
   // Declare the omitted limp explicitly; this exception cannot remove a
   // facing-raise call, a BB check, or an alternative from a native solve.
   if(n.unavailableActions!==undefined)fail(reference&&same(n.unavailableActions,['call'])&&n.state.table.highest===1&&n.state.table.heroStreet===0&&!n.actions.some(a=>a.type==='call'),'unsupported omission');
   fail(basic.every(type=>n.actions.some(a=>a.type===type)||n.unavailableActions?.includes(type)),'missing check/call/fold alternative');
   fail(JSON.stringify(n).length+JSON.stringify(p).length<9000,'decision exceeds the saved-review size budget');
  }
  return pack;
 }
 function create(packs=[],options={}){
  const catalogue=clone(packs),index=new Map(),byId=new Map();
  for(const pack of catalogue){
   validatePack(pack,options);fail(!byId.has(pack.id),'duplicate pack identity');byId.set(pack.id,pack);
   for(const n of pack.nodes){
    if(pack.active){const key=stable([n.context,n.state]);fail(!index.has(key),'overlapping solution packs');index.set(key,{pack,node:n});}
   }
  }
  function match(spot,table,ctx){return ctx?index.get(stable([ctx,state(spot,table)]))||null:null;}
  function evaluate(spot,table,ctx,code,amount=0){
   const found=match(spot,table,ctx);
   if(!found)return null;
   return score(found,spot,table,ctx,code,amount);
  }
  function score(found,spot,table,ctx,code,amount=0){
   const chosen=action(spot,table,code,amount);
   const {pack,node}=found,a=node.actions.find(a=>same({type:a.type,amountBB:a.amountBB},chosen));
   const best=Math.max(...node.actions.map(a=>a.evBB)),loss=a?Math.max(0,best-a.evBB):null;
   const inconsistentMix=a&&a.frequency>0&&loss>node.evToleranceBB;
   return {version:1,packId:pack.id,nodeId:node.id,sourceSHA256:pack.provenance.sourceSHA256,
    context:clone(ctx),state:state(spot,table),chosen,coverage:!legal(chosen,table)?'illegal-action':!a?'off-tree':inconsistentMix?'solver-uncertainty':'covered',
    grade:!a||inconsistentMix?'unscored':loss<=node.evToleranceBB?'good':'review',
    frequency:a?.frequency??null,evBB:a?.evBB??null,bestEVBB:best,lossBB:loss,potFraction:loss===null?null:loss/table.pot,
    actions:clone(node.actions),evToleranceBB:node.evToleranceBB,convergence:clone(node.convergence),explanation:node.explanation,
    source:{name:pack.name,engine:pack.provenance.engine,reference:pack.provenance.reference,assumptions:pack.provenance.gameAssumptions,rake:pack.provenance.rake,rangeReference:node.rangeReference,...(pack.provenance.review==='reviewed-reference'?{review:'reviewed-reference',evBasis:pack.provenance.evBasis,precisionBB:pack.provenance.precisionBB}: {})}};
  }
  function validRecord(r){
   const result=r.strategy,pack=byId.get(result?.packId),node=pack?.nodes.find(n=>n.id===result.nodeId);
   if(!node||!same(result.state,node.state)||!same(result.context,node.context)||r.grade!==result.grade)return false;
   const s=node.state,ctx=node.context;
   if(r.hole!==s.hole.join(' ')&&r.hole!==[...s.hole].reverse().join(' '))return false;
   if(r.board!==s.board.join(' ')||r.profile!==s.profile)return false;
   if(ctx.kind==='drill'&&r.spotId!==ctx.spotId)return false;
   if(ctx.kind==='hand'&&r.handId!==ctx.handId)return false;
   if(ctx.kind==='simulation'&&(r.mode!=='simulation'||r.handId!==ctx.handId||r.branchIndex!==ctx.branchIndex||r.simulationSeed!==ctx.seed||r.simulationVersion!==ctx.engine||r.simulationPolicy!==ctx.policy))return false;
   const spot={profile:s.profile,hero:s.hero,hole:s.hole,board:s.board,stack:s.startingStackBB,bb:s.bigBlind,smallBlind:s.smallBlind,history:s.history};
   const code=result.chosen?.type==='fold'?'fold':['check','call'].includes(result.chosen?.type)?'passive':'aggressive';
   const formatted=n=>Number(Number(n).toFixed(2)).toString(),a=result.chosen;
   const label=a.type==='fold'?'Fold':a.type==='check'?'Check':a.type==='call'?'Call '+formatted(a.amountBB)+'bb':(a.type==='raise'?'Raise to ':'Bet ')+formatted(a.amountBB)+'bb';
   if(r.choice!==label&&r.choice!==label+' (all-in)')return false;
   return same(score({pack,node},spot,s.table,ctx,code,result.chosen?.amountBB),result);
  }
  let practiceCache=null;
  const practiceSpots=()=>practiceCache||(practiceCache=[...index.values()].filter(({node:n})=>n.practice).map(({pack,node:n})=>{
   const s=n.state,t=clone(s.table);
   return {id:n.context.spotId,profile:s.profile,hero:s.hero,villain:t.active.filter(p=>p!==s.hero).join(' + '),hole:[...s.hole],board:[...s.board],stack:s.startingStackBB,bb:s.bigBlind,smallBlind:s.smallBlind,
    history:clone(s.history),tableSnapshot:t,pot:t.pot,bet:t.call,currentPot:t.pot,area:!s.board.length?'preflop':s.board.length===5?'river':'texture',level:1,sourceType:'solver-practice',practiceGroup:pack.id+':'+s.hero,practiceNode:pack.id+':'+n.id.split('.')[0],practiceLabel:n.practiceLabel||pack.name,options:[],best:-1,okay:[],why:n.explanation,heuristic:'Compare action EV and the long-run mix.',source:pack.name};
  }));
  return {match,evaluate,validRecord,practiceSpots,packCount:catalogue.length,nodeCount:index.size};
 }
 // Select the role and public decision before selecting a combo. A large
 // entering range must not crowd smaller ranges out of general practice.
 function pickPractice(spots,recent=[],random=Math.random){
  if(!spots.length)return null;
  const byId=new Map(spots.map(s=>[s.id,s])),seen=recent.slice(-32).map(id=>byId.get(id)).filter(Boolean),last=seen.at(-1);
  let pool=spots.filter(s=>!last||s.hero!==last.hero);if(!pool.length)pool=spots;
  const pick=a=>a[Math.min(a.length-1,Math.floor(random()*a.length))];
  function leastUsed(keys,key){const counts=keys.map(k=>seen.filter(s=>s[key]===k).length),minimum=Math.min(...counts);return pick(keys.filter((k,i)=>counts[i]===minimum));}
  const group=leastUsed([...new Set(pool.map(s=>s.practiceGroup))],'practiceGroup');pool=pool.filter(s=>s.practiceGroup===group);
  const node=leastUsed([...new Set(pool.map(s=>s.practiceNode))],'practiceNode');pool=pool.filter(s=>s.practiceNode===node);
  const fresh=pool.filter(s=>!recent.slice(-8).includes(s.id));return pick(fresh.length?fresh:pool);
 }
 return {state,context,action,legal,validateState,validatePack,create,pickPractice,stable};
})();
if(typeof module!=='undefined')module.exports=StrategyReview;
