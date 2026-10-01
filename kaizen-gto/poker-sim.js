'use strict';
// Legal no-limit Hold'em mechanics. Integer units are 0.01 big blinds.
// Strategy is injected separately; this module never grades a poker decision.
const PokerSim=(()=>{
 const VERSION=1,UNIT=100,ranks='23456789TJQKA',suits='shdc';
 const names=['High card','One pair','Two pair','Three of a kind','Straight','Flush','Full house','Four of a kind','Straight flush'];
 const cards=()=>[...ranks].flatMap(r=>[...suits].map(s=>r+s));
 const ticks=n=>Math.round(n*UNIT),bb=n=>n/UNIT,require=(v,m)=>{if(!v)throw Error(m);};
 function random(state){state.rng=(state.rng+0x6D2B79F5)>>>0;let t=state.rng;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
 function compare(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return Math.sign(d);}return 0;}
 function five(hand){
  const values=hand.map(c=>ranks.indexOf(c[0])+2).sort((a,b)=>b-a),counts=new Map();values.forEach(v=>counts.set(v,(counts.get(v)||0)+1));
  const groups=[...counts].sort((a,b)=>b[1]-a[1]||b[0]-a[0]),unique=[...counts.keys()].sort((a,b)=>b-a);
  const flush=hand.every(c=>c[1]===hand[0][1]);let straight=0;
  if(unique.length===5){if(unique[0]-unique[4]===4)straight=unique[0];else if(unique.join(',')==='14,5,4,3,2')straight=5;}
  if(flush&&straight)return [8,straight];
  if(groups[0][1]===4)return [7,groups[0][0],groups[1][0]];
  if(groups[0][1]===3&&groups[1][1]===2)return [6,groups[0][0],groups[1][0]];
  if(flush)return [5,...values];if(straight)return [4,straight];
  if(groups[0][1]===3)return [3,groups[0][0],...groups.slice(1).map(g=>g[0])];
  if(groups[0][1]===2&&groups[1][1]===2)return [2,...groups.slice(0,2).map(g=>g[0]).sort((a,b)=>b-a),groups[2][0]];
  if(groups[0][1]===2)return [1,groups[0][0],...groups.slice(1).map(g=>g[0])];
  return [0,...values];
 }
 function rank(hand){
  require(Array.isArray(hand)&&hand.length>=5&&hand.length<=7&&new Set(hand).size===hand.length&&hand.every(c=>/^[2-9TJQKA][shdc]$/.test(c)),'Invalid showdown cards.');
  let best=null;for(let a=0;a<hand.length-4;a++)for(let b=a+1;b<hand.length-3;b++)for(let c=b+1;c<hand.length-2;c++)for(let d=c+1;d<hand.length-1;d++)for(let e=d+1;e<hand.length;e++){const v=five([hand[a],hand[b],hand[c],hand[d],hand[e]]);if(!best||compare(v,best)>0)best=v;}return best;
 }
 function streetName(board){return board.length===0?'Preflop':board.length===3?'Flop':board.length===4?'Turn':'River';}
 function append(state,line){state.history.at(-1)[1]+=(state.history.at(-1)[1]?' · ':'')+line;}
 function preflopStrength(hole){const a=ranks.indexOf(hole[0][0])+2,b=ranks.indexOf(hole[1][0])+2;return a===b?.5+a/28:Math.max(a,b)/28+Math.min(a,b)/56+(hole[0][1]===hole[1][1]?.08:0)+(Math.abs(a-b)===1?.05:0);}
 function sampleHole(state,position,preflop){
  const actions=preflop.split(' · ').filter(s=>s.startsWith(position+': '));
  const raises=actions.filter(s=>s.includes('raises')).length,entered=actions.some(s=>s.includes('calls'));
  const exponent=raises>=2?8:raises?5:entered?2:0;
  let selected,weight=0;
  for(let a=0;a<state.deck.length-1;a++)for(let b=a+1;b<state.deck.length;b++){
   const combo=[state.deck[a],state.deck[b]],w=exponent?.01+Math.pow(preflopStrength(combo),exponent):1;weight+=w;
   if(random(state)*weight<w)selected=combo;
  }
  state.deck=state.deck.filter(c=>!selected.includes(c));return selected;
 }
 function replayPublicStreet(spot){
  let highest=spot.board.length?0:UNIT,fullRaise=UNIT;const acted={};
  const current=spot.history.at(-1)[1];
  for(const line of current.split(' · ')){
   const m=line.match(/^(You|SB|BB|UTG(?:\+\d)?|LJ|HJ|CO|BTN): (.*)$/);if(!m)continue;
   const position=m[1]==='You'?spot.hero:m[1],action=m[2];
   if(action.startsWith('posts'))continue;
   const raise=action.match(/^raises .* to ([\d.]+)bb/),bet=action.match(/^bets ([\d.]+)bb/);
   if(raise||bet){const target=ticks(Number((raise||bet)[1])),increase=target-highest;if(increase>=fullRaise)fullRaise=increase;highest=Math.max(highest,target);}
   if(/^(checks|calls|bets|raises)/.test(action))acted[position]=highest;
  }
  return {highest,fullRaise,acted};
 }
 function fromHand(hand,index=0,seed=1){
  require(hand?.spots?.[0]?.board.length===0,'Simulation needs a complete hand from preflop.');
  const source=hand.spots[index],first=hand.spots[0];require(source&&Number.isInteger(index),'Missing branch decision.');
  const t=source.tableSnapshot,initial=first.tableSnapshot;require(t&&initial,'Simulation needs exact table snapshots.');
  const starts=new Map(initial.seats.map(p=>[p.position,ticks(p.remaining)+ticks(p.street)]));
  const round=replayPublicStreet(source);
  require(Math.abs(round.highest-ticks(t.highest))<=1,'The prior betting cannot be reconstructed for simulation.');
  const known=[...source.hole,...source.board];require(new Set(known).size===known.length&&known.every(c=>/^[2-9TJQKA][shdc]$/.test(c)),'Invalid known cards.');
  const state={version:VERSION,seed:seed>>>0,rng:seed>>>0,handId:hand.id,sourceSpotId:source.id,branchIndex:index,hero:source.hero,
   bb:source.bb,smallBlind:source.smallBlind,profile:source.profile,area:source.area,level:source.level,
   order:[...t.order],board:[...source.board],initialBoard:[...source.board],history:structuredClone(source.history),
   highest:round.highest,fullRaise:round.fullRaise,status:'playing',actor:source.hero,decisions:0,actions:[],awards:[],refunds:[],pots:[],pot:0,
   players:t.seats.map(p=>({position:p.position,active:p.active,hero:p.position===source.hero,start:starts.get(p.position),remaining:ticks(p.remaining),street:ticks(p.street),total:starts.get(p.position)-ticks(p.remaining),acted:round.acted[p.position]??null,hole:[]})),
   deck:cards().filter(c=>!known.includes(c))};
  require(state.players.length===state.order.length&&state.players.every(p=>p.start!==undefined&&p.remaining>=0&&p.total>=0&&p.street<=p.total),'Inconsistent starting stacks.');
  state.bank=state.players.reduce((n,p)=>n+p.start,0);state.pot=state.players.reduce((n,p)=>n+p.total,0);
  require(Math.abs(state.pot-ticks(t.pot))<=2,'Pot contributions cannot be reconciled for simulation.');
  const preflop=source.history[0][1].replaceAll('You:',source.hero+':');
  for(const p of state.players)p.hole=p.hero?[...source.hole]:sampleHole(state,p.position,p.active?preflop:'');
  for(let i=state.deck.length-1;i>0;i--){const j=Math.floor(random(state)*(i+1));[state.deck[i],state.deck[j]]=[state.deck[j],state.deck[i]];}
  append(state,'Practice simulation begins here');assertState(state);return state;
 }
 function legal(state,position=state.actor){
  const p=state.players.find(p=>p.position===position);require(p,'Unknown player.');
  const call=Math.min(p.remaining,Math.max(0,state.highest-p.street)),max=p.street+p.remaining;
  const reopened=p.acted===null||state.highest-p.acted>=state.fullRaise;
  const canRaise=state.status==='playing'&&p.active&&max>state.highest&&reopened&&state.players.some(o=>o!==p&&o.active&&o.remaining>0);
  return {call,min:Math.min(max,state.highest+state.fullRaise),max,canRaise,check:call===0};
 }
 function refund(state){
  const sorted=[...state.players].sort((a,b)=>b.total-a.total),top=sorted[0],excess=top.total-sorted[1].total;
  if(excess>0&&top.active){top.total-=excess;top.remaining+=excess;top.street=Math.max(0,top.street-excess);state.pot-=excess;state.refunds.push({position:top.position,amount:bb(excess)});append(state,bb(excess)+'bb uncalled returned to '+(top.hero?'You':top.position));}
 }
 function settle(state){
  refund(state);const active=state.players.filter(p=>p.active);require(active.length>0,'No live player.');
  state.settledPot=state.pot;
  if(active.length===1){state.awards=[{position:active[0].position,amount:bb(state.pot),hand:'Uncontested'}];active[0].remaining+=state.pot;}
  else{
   require(state.board.length===5,'Showdown needs five community cards.');
   const ranksByPlayer=new Map(active.map(p=>[p.position,rank([...p.hole,...state.board])])),awards=new Map();let previous=0;
   for(const level of [...new Set(state.players.map(p=>p.total))].filter(n=>n>0).sort((a,b)=>a-b)){
    const contributing=state.players.filter(p=>p.total>=level),eligible=contributing.filter(p=>p.active),amount=(level-previous)*contributing.length;previous=level;
    require(eligible.length,'A side pot has no eligible player.');let best=null,winners=[];
    for(const p of eligible){const r=ranksByPlayer.get(p.position),c=best?compare(r,best):1;if(c>0){best=r;winners=[p];}else if(c===0)winners.push(p);}
    winners.sort((a,b)=>state.order.indexOf(a.position)-state.order.indexOf(b.position));
    const each=Math.floor(amount/winners.length),extra=amount%winners.length;
    winners.forEach((p,i)=>{const n=each+(i<extra?1:0);p.remaining+=n;awards.set(p.position,(awards.get(p.position)||0)+n);});
    state.pots.push({amount:bb(amount),eligible:eligible.map(p=>p.position),winners:winners.map(p=>p.position)});
   }
   state.awards=[...awards].map(([position,amount])=>({position,amount:bb(amount),hand:names[ranksByPlayer.get(position)[0]]}));
  }
  state.pot=0;state.status='complete';state.actor=null;state.players.forEach(p=>p.street=0);assertState(state);return state;
 }
 function deal(state){
  const count=state.board.length===0?3:1;require(state.deck.length>=count,'Not enough cards.');
  state.board.push(...state.deck.splice(0,count));state.history.push([streetName(state.board),'']);
  state.highest=0;state.fullRaise=UNIT;state.players.forEach(p=>{p.street=0;p.acted=null;});
 }
 function nextActor(state,after){
  if(state.players.filter(p=>p.active).length===1){settle(state);return;}
  const withChips=state.players.filter(p=>p.active&&p.remaining>0);
  const need=p=>p.active&&p.remaining>0&&(p.acted===null||p.street<state.highest);
  let next=null;
  if(withChips.length!==1||withChips[0].street<state.highest){for(let offset=1;offset<=state.order.length;offset++){const p=state.players.find(p=>p.position===state.order[(after+offset)%state.order.length]);if(need(p)){next=p;break;}}}
  if(next){state.actor=next.position;return;}
  refund(state);
  if(state.board.length===5){settle(state);return;}
  if(state.players.filter(p=>p.active&&p.remaining>0).length<2){while(state.board.length<5)deal(state);settle(state);return;}
  deal(state);state.actor=state.order.find(pos=>state.players.some(p=>p.position===pos&&p.active&&p.remaining>0));
 }
 function act(state,position,action,amount){
  require(state.status==='playing'&&state.actor===position,'It is not this player’s turn.');
  const p=state.players.find(p=>p.position===position),options=legal(state,position);let paid=0,label;
  if(action==='fold'){require(options.call>0,'Check is available.');p.active=false;label='folds';}
  else if(action==='passive'){paid=options.call;label=paid?'calls '+bb(paid)+'bb':'checks';}
  else if(action==='aggressive'){
   require(Number.isFinite(amount)&&Math.abs(amount*UNIT-ticks(amount))<.001,'Use sizes in hundredths of a big blind.');const target=ticks(amount);
   require(options.canRaise&&target>=options.min&&target<=options.max,'Illegal bet or raise.');
   paid=target-p.street;const increase=target-state.highest;label=state.highest?'raises to '+bb(target)+'bb':'bets '+bb(target)+'bb';
   if(increase>=state.fullRaise)state.fullRaise=increase;state.highest=target;
  }else throw Error('Unknown poker action.');
  p.remaining-=paid;p.street+=paid;p.total+=paid;state.pot+=paid;p.acted=state.highest;
  if(p.remaining===0&&p.active)label+=' (all-in)';
  const event={position,action,amount:action==='aggressive'?amount:null,paid:bb(paid),street:streetName(state.board),board:[...state.board],label};state.actions.push(event);
  if(p.hero)state.decisions++;append(state,(p.hero?'You':position)+': '+label);
  nextActor(state,state.order.indexOf(position));assertState(state);return event;
 }
 // The policy sees its own holding and public information only, never the deck or other hole cards.
 function view(state,position){
  const p=state.players.find(p=>p.position===position),l=legal(state,position);
  return {position,hole:[...p.hole],board:[...state.board],pot:bb(state.pot),remaining:bb(p.remaining),street:bb(p.street),highest:bb(state.highest),
   players:state.players.map(p=>({position:p.position,active:p.active,remaining:bb(p.remaining),street:bb(p.street)})),
   legal:{...l,call:bb(l.call),min:bb(l.min),max:bb(l.max)},history:structuredClone(state.history)};
 }
 function advance(state,policy){
  let count=0;while(state.status==='playing'&&state.actor!==state.hero){require(++count<1000,'Too many opponent actions.');const p=state.actor,choice=policy.choose(view(state,p),()=>random(state));act(state,p,choice.action,choice.amount);}return state;
 }
 function snapshot(state){
  const p=state.players.find(p=>p.hero),l=legal(state,state.hero),active=state.players.filter(p=>p.active);
  return {id:'SIM-'+state.handId+'-'+state.branchIndex+'-'+state.seed+'-'+state.decisions,handId:state.handId,sourceType:'simulation',
   profile:state.profile,area:state.board.length?'texture':'preflop',level:state.level,hero:state.hero,villain:active.filter(p=>!p.hero).map(p=>p.position).join(' + ')||'Table',
   hole:[...p.hole],board:[...state.board],bb:state.bb,smallBlind:state.smallBlind,stack:bb(p.start),pot:bb(state.pot),bet:bb(state.highest),currentPot:bb(state.pot),
   history:structuredClone(state.history),options:[],okay:[],best:-1,why:'Practice opponents use an authored heuristic policy. This simulation is not a GTO solution.',heuristic:'Compare the information and price at each decision; a simulated result is not a strategy grade.',
   tableSnapshot:{preflop:!state.board.length,order:[...state.order],active:active.map(p=>p.position),street:Object.fromEntries(state.players.map(p=>[p.position,bb(p.street)])),highest:bb(state.highest),heroStreet:bb(p.street),remaining:bb(p.remaining),call:bb(l.call),pot:bb(state.pot),min:bb(l.min),max:bb(l.max),canRaise:l.canRaise,committed:bb(p.total-p.street),read:'Practice opponents · sampled holdings · unscored',verb:state.highest?'Raise to':'Bet',seats:state.players.map(p=>({position:p.position,hero:p.hero,active:p.active,street:bb(p.street),remaining:bb(p.remaining)}))}};
 }
 function assertState(state){
  require(state.players.every(p=>Number.isInteger(p.remaining)&&Number.isInteger(p.total)&&p.remaining>=0&&p.total>=0&&p.street>=0),'Invalid chip accounting.');
  require(state.players.reduce((n,p)=>n+p.remaining,0)+state.pot===state.bank,'Chips were not conserved.');
  const all=[...state.board,...state.players.flatMap(p=>p.hole),...state.deck];require(new Set(all).size===all.length,'A card was dealt twice.');
  if(state.status==='playing')require(state.players.some(p=>p.position===state.actor&&p.active&&p.remaining>0),'Invalid acting player.');
 }
 return {VERSION,fromHand,legal,act,advance,view,snapshot,rank,compare,names,preflopStrength,assertState};
})();
if(typeof module!=='undefined')module.exports=PokerSim;
