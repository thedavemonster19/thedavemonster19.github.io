'use strict';
const GGImport = (() => {
 const cardList=s=>[...s.matchAll(/\b([2-9TJQKA][shdc])\b/g)].map(m=>m[1]);
 const round=n=>Math.round(n*1000000)/1000000;
 function parse(text, filename='GG export') {
  const chunks=text.split(/(?=Poker Hand #)/).filter(s=>/^Poker Hand #/.test(s.trim()));
  const hands=[],warnings=[];
  for(const chunk of chunks) {try {hands.push(parseHand(chunk.trim(),filename));}catch(error){warnings.push(error.message);}}
  if(!chunks.length) throw new Error('No GG cash-game hand headers found.');
  return {hands,warnings};
 }
 function parseHand(text,filename) {
  const header=text.match(/^Poker Hand #([^:]+): Hold'em No Limit \(\$([\d.]+)\/\$([\d.]+)\) - ([^\n]+)/);
  if(!header) throw new Error('Unsupported hand: expected a GG no-limit cash-game text export.');
  const [,id,sbText,bbText,date]=header,bb=Number(bbText),sb=Number(sbText);
  if(!bb||!sb||/\b(ante|straddle|run it twice)\b|^\*\*\* (FIRST|SECOND|THIRD) |posts missed blind/im.test(text)) throw new Error(id+': this export format needs a manual review.');
  const button=Number(text.match(/Seat #(\d+) is the button/)?.[1]);
  const players=[...text.matchAll(/^Seat (\d+): (.+) \(\$([\d.]+) in chips\)$/gm)].map(m=>({seat:Number(m[1]),name:m[2],stack:Number(m[3]),paid:0,street:0,active:true,roundActed:-1}));
  const hero=players.find(p=>p.name==='Hero');
  const hole=cardList(text.match(/^Dealt to Hero \[([^\]]+)\]/m)?.[1]||'');
  if(!hero||hole.length!==2||players.length<2||players.length>9||!button) throw new Error(id+': missing Hero, cards, or table seats.');
  const sorted=[...players].sort((a,b)=>a.seat-b.seat),bIndex=sorted.findIndex(p=>p.seat===button);
  if(bIndex<0) throw new Error(id+': button seat is missing.');
  const clockwise=[...sorted.slice(bIndex+1),...sorted.slice(0,bIndex+1)];
  const orders={2:['BB','BTN'],3:['SB','BB','BTN'],4:['SB','BB','CO','BTN'],5:['SB','BB','HJ','CO','BTN'],6:['SB','BB','UTG','HJ','CO','BTN'],7:['SB','BB','UTG','LJ','HJ','CO','BTN'],8:['SB','BB','UTG','UTG+1','LJ','HJ','CO','BTN'],9:['SB','BB','UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN']};
  clockwise.forEach((p,i)=>p.position=orders[players.length][i]);
  let board=[],streetName='Preflop',highest=bb,lastRaise=bb,roundId=0,pot=0,decision=0,history=[['Preflop',[]]];
  const spots=[],awards=[],reveals={},summaryPot=Number(text.match(/^Total pot \$([\d.]+)/m)?.[1]);
  const charges=[...text.matchAll(/(?:Rake|Jackpot|Bingo|Fortune|Tax) \$([\d.]+)/g)].reduce((sum,m)=>sum+Number(m[1]),0);
  if(!Number.isFinite(summaryPot)||!text.includes('*** SUMMARY ***'))throw new Error(id+': incomplete hand summary; replay skipped.');
  function snapshot(line) {
   if(hero.stack-hero.paid<0.001) return;
   const currentPaid=hero.street,remaining=hero.stack-hero.paid,toCall=Math.min(remaining,highest-currentPaid),opponents=players.filter(p=>p!==hero&&p.active);
   const plainHistory=history.map(([st,lines])=>[st,lines.join(' · ')]);
   if(!plainHistory.at(-1)[1]) plainHistory.at(-1)[1]='Action on you.';
   const s={id:'GG-'+id+'-'+(++decision),handId:id,sourceType:'history',sourceName:filename,sourceDate:date.trim(),
    profile:'online',level:1,area:board.length?'texture':'preflop',hero:hero.position,villain:opponents.map(p=>p.position).join(' + '),
    hole:[...hole],board:[...board],stack:hero.stack/bb,bb,smallBlind:sb,tableSize:players.length,pot:pot/bb,bet:highest/bb,
    currentPot:pot/bb,call:toCall/bb,history:plainHistory,options:[],best:-1,okay:[],why:'This is an unsolved replay from your hand history. The historical action is not a GTO recommendation.',heuristic:'Judge the decision using the information available at the time.',historicalAction:line,
    tableSnapshot:{preflop:!board.length,order:clockwise.map(p=>p.position),active:players.filter(p=>p.active).map(p=>p.position),
     street:Object.fromEntries(players.map(p=>[p.position,p.street/bb])),highest:highest/bb,heroStreet:currentPaid/bb,remaining:remaining/bb,
     call:toCall/bb,pot:pot/bb,min:Math.min(currentPaid+remaining,highest?highest+lastRaise:bb)/bb,max:(currentPaid+remaining)/bb,
     canRaise:hero.roundActed<roundId && currentPaid+remaining>highest+0.001 && opponents.some(p=>p.stack-p.paid>0.001),
     read:'',committed:(hero.paid-hero.street)/bb,verb:highest?'Raise to':'Bet',
     seats:clockwise.map(p=>({position:p.position,hero:p===hero,active:p.active,street:p.street/bb,remaining:(p.stack-p.paid)/bb}))}};
   if(new Set([...hole,...board]).size!==hole.length+board.length) throw new Error(id+': duplicate cards in export.');
   spots.push(s);
  }
  for(const rawLine of text.split('\n')) {
   const line=rawLine.trim();
   if(/^\*\*\* SUMMARY/.test(line)) break;
   if(/^\*\*\* SHOWDOWN/.test(line)) continue;
   const deal=line.match(/^\*\*\* (FLOP|TURN|RIVER) \*\*\* (.*)/);
   if(deal){streetName=deal[1][0]+deal[1].slice(1).toLowerCase();board=cardList(deal[2]);highest=0;lastRaise=bb;roundId=0;players.forEach(p=>{p.street=0;p.roundActed=-1;});history.push([streetName,[]]);continue;}
   const uncalled=line.match(/^Uncalled bet \(\$([\d.]+)\) returned to (.+)/);
   if(uncalled){const p=players.find(p=>p.name===uncalled[2]);if(p){const amount=Number(uncalled[1]);if(amount>p.street+.011||amount>p.paid+.011)throw new Error(id+': invalid uncalled return.');p.paid=round(p.paid-amount);p.street=round(p.street-amount);pot=round(pot-amount);history.at(-1)[1].push(round(amount/bb)+'bb returned to '+(p===hero?'You':p.position));}continue;}
   const collected=line.match(/^(.+) collected \$([\d.]+) from (.+)$/);
   if(collected){const p=players.find(p=>p.name===collected[1]);if(p)awards.push({position:p.position,amount:Number(collected[2])/bb});continue;}
   const actor=players.find(p=>line.startsWith(p.name+': '));
   if(!actor) continue;
   const action=line.slice(actor.name.length+2);
   if(action.startsWith('shows ')){reveals[actor.position]=cardList(action.match(/\[([^\]]+)\]/)?.[1]||'');continue;}
   if(!/^(posts (small|big) blind|folds|checks|calls|bets|raises)/.test(action)) continue;
   const label=action.replace(/\$([\d.]+)/g,(_,n)=>Number(round(Number(n)/bb).toFixed(2))+'bb');
   if(actor===hero&&!action.startsWith('posts')) {
    snapshot(hero.position+': '+label);
    if(spots.length)spots.at(-1).recordedChoice={action:action.startsWith('folds')?'fold':/^(checks|calls)/.test(action)?'passive':'aggressive',amount:/^raises/.test(action)?Number(action.match(/to \$([\d.]+)/)?.[1])/bb:/^bets/.test(action)?Number(action.match(/\$([\d.]+)/)?.[1])/bb:null};
   }
   let amount=0;
   if(action.startsWith('folds')) actor.active=false;
   else if(action.startsWith('raises')){const target=Number(action.match(/to \$([\d.]+)/)?.[1]);if(!Number.isFinite(target)) throw new Error(id+': unsupported raise.');amount=target-actor.street;const increase=target-highest;if(increase+0.0001>=lastRaise){lastRaise=increase;roundId++;}highest=Math.max(highest,target);}
   else if(/^(calls|bets|posts)/.test(action)){amount=Number(action.match(/\$([\d.]+)/)?.[1]);if(!Number.isFinite(amount))throw new Error(id+': missing amount.');if(action.startsWith('bets')){highest=actor.street+amount;lastRaise=Math.max(bb,amount);roundId++;}}
   if(amount<-.001||actor.paid+amount>actor.stack+.011)throw new Error(id+': contributions do not match the stacks.');
   actor.paid=round(actor.paid+amount);actor.street=round(actor.street+amount);pot=round(pot+amount);
   if(!action.startsWith('posts'))actor.roundActed=roundId;
   history.at(-1)[1].push((actor===hero?'You':actor.position)+': '+label);
  }
  if(Number.isFinite(summaryPot)&&Math.abs(summaryPot-pot)>.021)throw new Error(id+': action totals do not match the summary pot; replay skipped.');
  if(!spots.length)throw new Error(id+': no supported Hero decisions.');
  const awarded=awards.reduce((sum,a)=>sum+a.amount*bb,0);
  const cards=[...hole,...board,...Object.entries(reveals).filter(([position])=>position!==hero.position).flatMap(([,cards])=>cards)];
  const complete=Math.abs(summaryPot-charges-awarded)<.021&&awards.length>0&&spots[0].board.length===0&&new Set(cards).size===cards.length;
  const terminal={board:[...board],history:history.map(([st,lines])=>[st,lines.join(' · ')]),pot:pot/bb,charges:round(charges/bb),awards,reveals,
   heroInvested:round(hero.paid/bb),heroWon:round(awards.filter(a=>a.position===hero.position).reduce((n,a)=>n+a.amount,0)),
   seats:clockwise.map(p=>({position:p.position,hero:p===hero,active:p.active,street:p.street/bb,remaining:(p.stack-p.paid)/bb}))};
  return {id,date:date.trim(),filename,spots,replay:complete?{version:1,terminal}:null};
 }
 function report(text,filename) {
  const themes=[],tests={value:/value[\s-]*(?:bet|siz)|under[\s-]*(?:charg|siz)|calling station/i,draws:/combo[\s-]*draw|flush draw|strong draw|nut (?:flush|draw)/i,preflop:/pre[\s-]*flop|3[\s-]*bet|three[\s-]*bet|open[\s-]*limp/i,texture:/board texture|c[\s-]*bet|continuation bet/i,river:/bluff[\s-]*catch|river|passive aggression/i};
  let inStrengths=false;
  const working=text.split('\n').filter(line=>{if(/^#{1,6} /.test(line))inStrengths=/strength|retired|resolved/i.test(line);return !inStrengths;}).join('\n');
  for(const [key,re] of Object.entries(tests)) if(re.test(working)) themes.push(key);
  return {name:filename,kind:'report',themes,summary:themes.length?'Suggested practice topics detected in review text. Tentative until confirmed by repeated decisions.':'No supported topic detected. Saved for reference; practice weights unchanged.',text:text.slice(0,50000)};
 }
 return {parse,report};
})();
if(typeof module!=='undefined')module.exports=GGImport;
