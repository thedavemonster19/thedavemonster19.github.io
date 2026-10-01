'use strict';
// Authored teaching interpretations. Numerical results remain in the immutable
// solver packs; this layer never claims the engine supplied verbal reasoning.
const StrategyCoach=(()=>{
 const suits={s:'♠',h:'♥',d:'♦',c:'♣'},ranks='23456789TJQKA';
 const name=v=>({14:'ace',13:'king',12:'queen',11:'jack',10:'ten'}[v]||String(v));
 const label=cards=>cards.map(c=>c[0]+suits[c[1]]).join(' ');
 function handFacts(state){
  const poker=typeof PokerSim!=='undefined'?PokerSim:require('./poker-sim.js');
  const all=[...state.hole,...state.board],rank=poker.rank(all),top=Math.max(...state.board.map(c=>ranks.indexOf(c[0])+2));
  let made=['high card','one pair','two pair','three of a kind','a straight','a flush','a full house','four of a kind','a straight flush'][rank[0]];
  if(rank[0]===1&&rank[1]===top&&state.hole.some(c=>ranks.indexOf(c[0])+2===top))made='top pair';
  if(rank[0]===1&&state.hole[0][0]===state.hole[1][0]&&rank[1]>top)made='an overpair';
  const counts={};for(const c of all)counts[c[1]]=(counts[c[1]]||0)+1;
  const boardCounts={};for(const c of state.board)boardCounts[c[0]]=(boardCounts[c[0]]||0)+1;
  const pairedBoard=Object.values(boardCounts).some(n=>n>=2),sharedPair=rank[0]===1&&state.board.filter(c=>ranks.indexOf(c[0])+2===rank[1]).length===2;
  const pairBelowBoard=pairedBoard&&rank[0]===2&&state.hole[0][0]===state.hole[1][0]&&ranks.indexOf(state.hole[0][0])+2<top;
  if(sharedPair)made='the board’s pair with your kickers';
  let draw='';
  if(state.board.length<5&&rank[0]<5){
   const suit=Object.keys(counts).find(s=>counts[s]===4&&state.hole.some(c=>c[1]===s));
   if(suit)draw='You also have a flush draw; making the flush still requires another '+({s:'spade',h:'heart',d:'diamond',c:'club'}[suit])+'.';
   else if(state.board.length===3&&state.hole.includes('Kd')&&state.board.filter(c=>c[1]==='d').length===2)draw='K♦ gives a backdoor diamond draw, not a normal flush draw: both turn and river must be diamonds.';
  }
  if(state.board.length<5&&rank[0]<4){
   const values=cards=>new Set(cards.flatMap(c=>c[0]==='A'?[1,14]:[ranks.indexOf(c[0])+2])),held=values(all),boardValues=values(state.board);let straightDraw=false;
   for(let low=1;low<=10;low++){const run=Array.from({length:5},(_,i)=>low+i);if(run.filter(v=>held.has(v)).length===4&&run.filter(v=>boardValues.has(v)).length<4)straightDraw=true;}
   if(straightDraw)draw+=(draw?' ':'')+'You have a straight draw. A completed straight can still lose to a higher straight or a flush.';
  }
  return {rank,made,draw,pairedBoard,sharedPair,pairBelowBoard,text:label(state.hole)+' on '+label(state.board)+' gives you '+made+'.'};
 }
 function actsLast(state){
  // Active players are a membership list, not an action sequence. The table
  // order runs from the blinds around to the button in these reference models.
  return state.table.order.filter(p=>state.table.active.includes(p)).at(-1)===state.hero;
 }
 function preflop(result){
  const s=result.state,t=s.table,paired=s.hole[0][0]===s.hole[1][0],suited=s.hole[0][1]===s.hole[1][1];
  const opening=t.highest===1&&t.call>0,points=[];
  if(opening)points.push('You have '+(t.active.length-1)+' players still in the hand after you. Opening from an earlier seat requires a range that can face more players; late position gives fewer opponents a chance to continue.');
  else if(t.call)points.push('Calling costs '+t.call+'bb into '+t.pot+'bb. The immediate pot-odds benchmark is '+(100*t.call/(t.pot+t.call)).toFixed(1)+'% equity before rake and later betting. Preflop equity is not always fully realized, especially out of position or with players still to act.');
  else points.push('The small blind has completed and you can check without adding chips. Raising needs to improve on taking that option; compare the extra value and folds with the cost of building a pot.');
  if(paired)points.push('Your pocket pair starts with showdown value. Small pairs often need a favorable flop to continue against strong ranges; large pairs can get value from weaker hands. Stack depth and the price matter more than a blanket rule to always play a pair.');
  else{
   points.push(suited?'These suited cards can make flushes and useful draws. Combine that potential with rank, connectivity and position when deciding whether they can continue.':'These offsuit cards rely more on making strong pairs or straights. When a stronger range continues, a dominated pair can become expensive; evaluate the kicker and the range you face.');
   if(s.hole.some(c=>c[0]==='A'))points.push('Holding an ace removes some AA and AK combinations from opponents’ ranges. That blocker can matter when raising, but the value of continuing still depends on this hand’s other card and the exact action history.');
  }
  if(['SB','BB'].includes(s.hero))points.push('The blind you already posted is sunk. A negative source action EV can still improve on folding; compare the EV difference between the available choices.');
  if(t.highest>1)points.push('Earlier actions have narrowed the ranges. This decision uses the hand classes that actually reach the source node, rather than starting again with every possible hand.');
  if(t.highest>=20)points.push('A large reraise is a fresh decision. Chips already invested do not oblige you to continue; compare folding now with committing more against the range that reaches this action.');
  const takeaway=opening?'Start with position and the players behind you, then decide which hands can profitably open.':t.call?'Judge the price, the range you face, and how well your hand can realize its equity.':'A free check is a valuable option. Raise when the extra value and folds justify building the pot.';
  return {title:opening?'Build a position-aware opening range':'Connect the starting hand to the price',hand:label(s.hole)+' · '+s.hero+' · '+(paired?'pocket pair':suited?'suited':'offsuit')+'.',draw:'',points,takeaway,attribution:'Coaching interpretation of the preflop reference.'};
 }
 function explain(result){
  const state=result.state;if(!state)return null;
  if(!state.board.length)return result.source?.review==='reviewed-reference'?preflop(result):null;
  const facts=handFacts(state),lead=result.actions.reduce((a,b)=>b.frequency>a.frequency?b:a),points=[];
  const threeBet=['sb-bb-3bet-kcjd6d-model-v1','sb-bb-3bet-ip-practice-v1'].includes(result.packId),singleRaised=['co-bb-4c8dqh-model-v1','co-bb-srp-practice-v1'].includes(result.packId)||result.packId.startsWith('co-bb-texture-'),riverPressure=result.packId.startsWith('co-bb-river-pressure-'),inPosition=actsLast(state);
  if(!threeBet&&!singleRaised&&!riverPressure)return null;
  let title='How to think about this decision',takeaway;
  // This continuation was exported and independently checked by enumerating
  // every river payoff. Bind the explanation to the frozen source, not merely
  // the board: different entering ranges or action paths need their own audit.
  const auditedFlush=threeBet&&result.sourceSHA256==='235625176df9ba5f280823d73d54e845e94c98db7b9bb6310dd4c67545861a35'&&result.nodeId==='river-range.AdQd';
  if(auditedFlush){
   return {title:'Check with a plan to raise',hand:facts.text,draw:facts.draw,points:[
    'This river check leaves BB a chance to bet. In the exported model, BB bets 12bb about 35.6% of the time against your holding; A♦Q♦ then raises to 36bb at 100%. The checking EV includes that response and the remaining action.',
    'Checking and responding is worth 22.088bb in this model, compared with 21.529bb for leading 12bb. If both players simply checked through, the value would be 15.200bb after rake. The extra value comes from further betting, not from giving up value with your flush.',
    'A tighter rerun still chooses check and then raise, but estimates the advantage at 0.369bb instead of the displayed export’s 0.559bb. The plan is consistent across these runs; the exact EV gap is an estimate.',
    'This is not an instruction to check every street. On the flop A♦Q♦ is a flush draw and checks in this model. On the 9♦ turn it makes the flush and mixes check 49.3% / bet 12bb 50.7%. The river drill starts after the checking branch.',
    'The 9♥ pairs the board, but possible full houses alone do not explain this result. It depends on the range that actually reaches the river and how BB responds. Against a player who checks back too often, the value of setting up a check-raise can fall.'
   ],takeaway:'A check needs a continuation plan. Ask what you gain when the opponent bets, as well as what you miss when they check back.',attribution:'Continuation verified against the exported model; broader coaching is interpretation.'};
  }
  if(state.table.call){
   const price=100*state.table.call/(state.table.pot+state.table.call);
   points.push('You face a bet. Calling costs '+state.table.call+'bb into '+state.table.pot+'bb. The immediate pot-odds benchmark is '+price.toFixed(1)+'% equity, ignoring rake and further betting.');
   points.push('That price alone cannot decide the call. Your hand’s equity, the betting range and future bets matter. A raise needs worse hands to call or enough hands to fold; it is not automatically justified by wanting protection.');
   takeaway='Separate the price of calling from what the opponent’s betting range contains.';
   if(state.table.heroStreet){title='Reassess after the raise';points.push('Your earlier bet does not commit you to calling the raise. Reassess which value hands and bluffs raise, and whether this holding can profitably continue at the new price.');takeaway='Treat a raise as a new range and price decision. The chips you already bet are sunk.';}
   if(state.board.length===5){
    title=state.table.call===state.table.remaining?'Decide whether to call the all-in':state.table.call>state.table.pot-state.table.call?'Defend against the overbet':title;
    points.push('No cards remain to improve your hand. A bluff-catcher earns its call from the bluffs it beats; a strong-looking pair can still be a fold against a sufficiently strong betting range. Avoid calling only because of the hand’s absolute rank.');
    if(!state.table.heroStreet)takeaway='Compare the price with the value hands and bluffs that take this river line. A big bet needs a range decision, not an automatic fold or call.';
   }
  }else if(state.board.length===5){
   title='What matters on the river';
   points.push(inPosition?'The opponent has checked to you. Checking back takes the hand to showdown; a bet must earn more from the range that responds.':'When you act first, check does not mean checking through to showdown. Its EV includes the opponent’s possible bet and your later call, raise or fold in the model.');
   points.push('No cards remain, so betting cannot protect against a future draw. A value bet needs calls from worse hands; a bluff needs enough better hands to fold.');
   points.push(riverPressure?'The entering river ranges are authored assumptions after the two called barrels shown in the history. This river-only solve does not certify the earlier actions. Compare how each river size performs against these ranges.':'Earlier checks change which hands reach this river. The displayed mix uses those reached ranges, not fresh preflop ranges. Use the action EVs to see whether betting gains enough over keeping the option to check and respond.');
   takeaway='On the river, ask “What worse hand calls, or what better hand folds?” rather than betting for protection.';
  }else{
   title=lead.type==='check'?'Why checking makes sense':lead.frequency>.99?'Why betting can make sense':'Why this hand can mix';
   if(threeBet&&state.board.length===3){
    points.push(inPosition?'You 3-bet from BB and now act after SB. Your model range includes AA, AK, KK and JJ; SB’s calling range has no AA or KK. That strong range helps on this king-high flop, but your exact holding still determines the action mix.':'You called BB’s preflop 3-bet and act first. In this model BB can have AA, AK, KK and JJ, while your entering range has no AA or KK. The strong end of BB’s range connects with this king-high flop.');
   }else if(singleRaised&&state.board.length===3){
    points.push(inPosition?'You opened from CO and act after the big blind. Your model range retains the premium pairs; BB’s defending range is wider. Use the exact hand’s mix rather than assuming that being the preflop raiser requires a continuation bet.':'You defended the big blind against CO’s raise and act first. CO’s model range keeps the premium pairs; your defending range is wider and does not contain every premium hand. Your own pair or draw is only one part of that comparison.');
   }else{
    points.push(/bets|raises/.test(state.history[1][1])?'The flop bet and response narrow both ranges before this turn. The new card changes which hands can value bet, bluff or continue; use the reached ranges rather than repeating the previous street’s action.':'The flop checked through. Those checks narrow both ranges before this turn; a hand’s role can change when the new card arrives. This is a different decision from simply repeating the flop action.');
   }
   if(facts.sharedPair){
    points.push('The pair is on the board, so your opponent shares it. Your kickers and draws determine how much extra strength you hold; do not count the board’s pair as a private made-hand advantage.');
    takeaway='On a paired board, identify what your hole cards add beyond the pair everyone shares.';
   }else if(facts.pairBelowBoard){
    points.push('The board supplies the higher pair. Your pocket pair makes two pair, but an opponent holding the board’s paired rank has trips. This is different from making two pair with both hole cards on an unpaired board.');
    takeaway='A two-pair label is not enough: separate the shared board pair from the strength of your pocket pair.';
   }else if(facts.made==='an overpair'){
    points.push('Your pocket pair is higher than every board card. A bet can earn value from lower pairs and draws, but how much they continue depends on the range and size. Compare that value with checking; an overpair is strong but does not require automatic aggression.');
    takeaway='With an overpair, identify the worse hands that can pay you and choose a size they can continue against.';
   }else if(facts.made.startsWith('top pair')){
    points.push('Protection has a price: a small lead may fold weaker unpaired hands, while stronger made hands and good draws can continue. Betting does not automatically remove the hands that threaten your top pair.');
    points.push(inPosition?'Checking behind keeps the pot smaller with one pair and lets weaker hands reach the next street. Betting can still earn calls from worse; compare that value with the benefit of taking the next card.':'Checking keeps weaker hands and potential bluffs involved, avoids voluntarily enlarging the pot with one pair, and gives your checking range hands that can continue. Checking is not a promise to fold to a bet.');
    takeaway='Do not bet every top pair just to avoid a scary '+(state.board.length===3?'turn':'river')+'. Weigh denied equity against the range that continues.';
   }else if(facts.rank[0]>=2){
    points.push('A strong made hand can earn value by betting, but checking can also retain bluffs and give your checking range strong hands. Protection is only one consideration; it does not require every strong hand to bet.');
    takeaway='Compare value from worse calls with the value of keeping weaker hands and bluffs involved.';
   }else if(facts.rank[0]===1){
    points.push('Your pair can still beat missed hands, but a bet may fold those hands while stronger pairs and draws continue. Checking preserves the option to reach showdown without first making the pot larger yourself.');
    takeaway='With a modest pair, distinguish a useful protection bet from a bet that mostly gets action from better hands.';
   }else{
    points.push(inPosition?'Without a made pair, betting needs fold equity and/or enough drawing equity. Checking behind takes the next card without another bet on this street.':'Without a made pair, betting needs fold equity and/or enough drawing equity. Checking avoids paying immediately for a bluff, but can still face a bet; it does not guarantee a free card.');
    takeaway='Choose aggression for the hands that fold and the equity you retain when called, not simply because you missed.';
   }
  }
  return {title,hand:facts.text,draw:facts.draw,points,takeaway,attribution:'Coaching interpretation of this model; the solver supplies the percentages and EVs, not a written explanation.'};
 }
 return {explain,handFacts,actsLast};
})();
if(typeof module!=='undefined')module.exports=StrategyCoach;
