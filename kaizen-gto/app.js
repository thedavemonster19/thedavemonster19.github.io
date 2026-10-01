'use strict';
// Decision identifiers are not authentication tokens. Support HTTP preview too.
function decisionId(){
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const $=id=>document.getElementById(id);
const labels={value:'Value sizing',draws:'Strong draws',preflop:'Preflop',texture:'Board texture',river:'River decisions'};
const suits={s:'♠',h:'♥',d:'♦',c:'♣'},suitNames={s:'spades',h:'hearts',d:'diamonds',c:'clubs'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(Number(n).toFixed(2)).toString();
const cash=(n,s=current)=>'$'+(n*(s.bb||(s.profile==='live'?3:.5))).toFixed(2);
let records=[],session=[],imports=[],current=null,table=null,answered=false,rep=0,streak=0,amount=0,missMode=false,recent=[],mix=[],pending=[],saving=false,clockStart=0,clockElapsed=0,progressReady=false,storedProgressLoaded=false,transferBusy=false,importBusy=false;
const savedDecisionIds=new Set();
let guidedAttempt=null,guidedSetId=null,guidedSetCountable=true,setNextFocus='all',handViewReset=0;
let replayRun=null,replayTimer=null,replaySessionId=null,terminalReveals=null,simRun=null;
const allSpots=()=>[...new Map([...SPOTS,...SEED_HANDS.flatMap(h=>h.spots),...CORPUS.spots,...imports.filter(i=>['hand','drill-pack'].includes(i.kind)).flatMap(i=>i.spots||[]),...SOLVED_SPOTS,...guidedPracticeSpots].map(s=>[s.id,s])).values()];
const allReplayHands=()=>[...new Map([...REPLAY_HANDS,...SEED_HANDS,...imports.filter(i=>i.kind==='hand')].filter(HandReplay.available).map(h=>[h.id,h])).values()];
const personalHands=()=>[...new Map([...REPLAY_HANDS,...SEED_HANDS,...imports.filter(i=>i.kind==='hand')].map(h=>[h.id,h])).values()];
let handCoverageCache=null;
function handCoverage(){
 const hands=personalHands();
 if(!handCoverageCache||hands.length!==handCoverageCache.hands.length||hands.some((h,i)=>h!==handCoverageCache.hands[i]))handCoverageCache={hands,result:HandReplay.coverage(hands,strategyCatalogue,PokerTable,StrategyReview)};
 return handCoverageCache.result;
}
function readyHandSpots(handId){
 return handCoverage().ready.filter(s=>(!handId||s.handId===handId)&&($('profile').value==='all'||s.profile===$('profile').value)&&(['all','history'].includes($('focus').value)||s.area===$('focus').value));
}
function selectedReplayHands(){const ids=new Set(readyHandSpots().map(s=>s.handId));return personalHands().filter(h=>ids.has(h.id));}
function dealReadyHand(handId,forced){
 strategyContinuation=null;clearTimeout(replayTimer);replayRun=null;simRun=null;terminalReveals=null;guidedAttempt=null;
 $('practice-mode').value='hand';$('set-review').hidden=true;$('play-panel').classList.remove('set-complete');
 const pool=readyHandSpots(handId);
 const spot=forced?pool.find(s=>s.id===forced.id):HandReplay.pickReady(pool,personalHands(),records.filter(r=>strategyCatalogue.validRecord(r)),recent);
 if(!spot){emptyTable();return;}
 current=structuredClone(spot);table=PokerTable.state(current);answered=false;rep++;recent.push(spot.id);clockStart=performance.now();clockElapsed=0;
 render();resetHandView();
}
function isReadyHandMode(){return isHandMode()&&!replayRun&&!simRun;}
function isHandMode(){return $('practice-mode').value==='hand';}
function isGuidedMode(){return $('practice-mode').value==='strategy';}
function guidedRecords(list=records){return GuidedPractice.verified(list,strategyCatalogue);}
function currentSet(){return GuidedPractice.sets(guidedRecords()).find(s=>s.id===guidedSetId)||{id:guidedSetId,records:[],retries:0};}
function setComplete(){return currentSet().records.length===10;}
function setReport(group,full=false){
 const rows=group.records,good=rows.filter(r=>GuidedPractice.impact(r.strategy).key==='low'),small=rows.filter(r=>GuidedPractice.impact(r.strategy).key==='small');
 const ordered=[...rows].sort((a,b)=>b.strategy.lossBB-a.strategy.lossBB),priorities=ordered.filter(r=>r.strategy.lossBB>=.5),themes=new Map();
 for(const r of rows){const name=GuidedPractice.lesson(r);if(!themes.has(name))themes.set(name,{name,good:0,count:0});const theme=themes.get(name);theme.count++;if(r.grade==='good')theme.good++;}
 const strengths=[...themes.values()].filter(t=>t.good).sort((a,b)=>b.good-a.good).slice(0,2);
 const handLabel=r=>esc(r.hole.replace(/[shdc]/g,c=>suits[c]))+' · '+(r.board?['','','','Flop','Turn','River'][r.strategy.state.board.length]:'Preflop')+' · '+esc(r.strategy.state.hero);
 const first=GuidedPractice.firstAttempts(rows).length;
 const stats=`<div class="set-metrics"><div><strong>${good.length}/10</strong><span>Low-loss choices</span></div><div><strong>${small.length}</strong><span>Small differences</span></div><div><strong>${priorities.length}</strong><span>Review first</span></div></div>`;
 const soundFolds=good.filter(r=>r.strategy.chosen.type==='fold'&&GuidedPractice.pressure(r.strategy.state,r.strategy.state.table)).length;
 const positive=(soundFolds?`<p><strong>${soundFolds} low-loss ${soundFolds===1?'fold':'folds'} under pressure.</strong> You let the hand go without giving up meaningful model EV.</p>`:'')+(strengths.length?strengths.map(t=>`<p><strong>${esc(t.name)}</strong><br>${t.good} of ${t.count} choices kept EV loss within the grading tolerance.</p>`).join(''):'<p>You completed the set. Start with the largest miss below and use its takeaway on your next decisions.</p>');
 const review=priorities.length?priorities.slice(0,3).map(r=>`<article class="set-priority"><strong>Decision ${r.practiceSet.slot} · ${esc(GuidedPractice.lesson(r))}</strong><p>${handLabel(r)}<br>You chose ${esc(r.choice)} · <b>${fmt(r.strategy.lossBB)}bb EV loss</b></p><p><strong>Model mix:</strong> ${r.strategy.actions.filter(a=>a.frequency>=.01).sort((a,b)=>b.frequency-a.frequency).map(a=>esc(strategyActionLabel(a))+' '+esc(strategyFrequency(a.frequency))).join(' · ')}</p><p>${esc(StrategyCoach.explain(r.strategy)?.takeaway||r.heuristic)}</p></article>`).join(''):`<p><strong>No EV loss of 0.5bb or more.</strong> ${small.length?'There are '+small.length+' small differences to refine. The detailed mixes are below.':'Keep building recognition across unfamiliar decisions.'}</p>`;
 const detail=full?`<h3>Your 10 decisions</h3><p class="small muted">Open a decision for its action mix and explanation. Decision 10 is your most recent answer.</p><div class="set-decisions">${rows.map((r,i)=>`<details><summary><span class="set-ordinal">${i+1}</span><span>${handLabel(r)}<small>${esc(r.choice)} · ${esc(GuidedPractice.impact(r.strategy).label)} · ${fmt(r.strategy.lossBB)}bb</small></span></summary><div class="set-decision-feedback">${strategyFeedback(r.strategy)}</div></details>`).join('')}</div>`:'';
 return stats+`<p class="set-caption">${first} new decisions · ${10-first} previously seen · ${group.retries} immediate retries kept separate. Low-loss choices include acceptable mixed actions.</p><div class="set-lessons"><section><h3>What went well</h3>${positive}</section><section><h3>What to work on</h3>${review}</section></div><details class="small muted set-scoring"><summary>How this set is scored</summary><p>Review priorities start at 0.5bb EV loss; small differences are above the source grading tolerance but below 0.5bb. These are coaching bands, not different solver grades. EV loss is a model comparison, not money actually lost.</p></details>`+detail;
}
function showSetReview(){
 const group=currentSet();if(group.records.length!==10)return false;
 answered=true;$('play-panel').classList.remove('decision-active');$('play-panel').classList.add('set-complete');$('set-review').hidden=false;
 $('spot-heading').textContent='Set complete';$('game-tag').textContent='10 DECISIONS · YOUR REVIEW';$('set-review-content').innerHTML=setReport(group,true);
 const priority=[...group.records].sort((a,b)=>b.strategy.lossBB-a.strategy.lossBB)[0];
 setNextFocus=GuidedPractice.pressure(priority.strategy.state,priority.strategy.state.table)?'pressure':priority.area;
 $('set-targeted').hidden=priority.strategy.lossBB<.5;$('set-targeted').textContent='Practise '+(setNextFocus==='pressure'?'facing pressure':GuidedPractice.topics[setNextFocus].toLowerCase())+' →';
 for(const id of ['next','skip','fold-action','passive-action','aggressive-action'])$(id).disabled=true;
 $('retry-decision').hidden=true;countPool();resetHandView();return true;
}
function startNextSet(focus){if(transferBusy)return;guidedSetId=decisionId();missMode=false;if(focus)$('focus').value=focus;begin();updateStats();}
function cards(list,count=0){return list.map(c=>`<span class="card ${c[1]}" aria-label="${c[0]==='T'?'10':c[0]} of ${suitNames[c[1]]}">${c[0]==='T'?'10':c[0]}<small aria-hidden="true">${suits[c[1]]}</small></span>`).join('')+Array.from({length:Math.max(0,count-list.length)},()=>'<span class="card placeholder" aria-hidden="true"></span>').join('');}
function selectedPool(){
 const level=$('difficulty').value==='auto'?Practice.level(records):Number($('difficulty').value);
 const mode=$('practice-mode').value;
 return allSpots().filter(s=>(mode==='strategy'?s.sourceType==='solver-practice':mode==='solved'?s.sourceType==='solver-model':!['solver-model','solver-practice'].includes(s.sourceType))&&($('profile').value==='all'||s.profile===$('profile').value)&&
  ($('focus').value==='all'||($('focus').value==='pressure'?!!s.pressureKind:$('focus').value==='postflop'?s.board.length>0:$('focus').value==='history'?s.sourceType==='history':s.area===$('focus').value))&&
  (!level||s.level<=level));
}
function countPool(){
 const hand=isHandMode(),mode=$('practice-mode').value,pool=hand?selectedReplayHands():selectedPool(),n=pool.length;
 $('path-practice').setAttribute('aria-pressed',String(mode==='strategy'));
 $('path-hands').setAttribute('aria-pressed',String(hand));
 $('explore-label').textContent=mode==='solved'?'GTO lab':mode==='drill'?'Coaching':'Explore';
 $('mode-description').hidden=mode==='strategy';
 const preflop=pool.filter(s=>s.board?.length===0),postflop=pool.filter(s=>s.board?.length>=3);
 const flopModels=postflop.filter(s=>!s.practiceGroup?.startsWith('co-bb-river-pressure-')),riverModels=new Set(postflop.filter(s=>s.practiceGroup?.startsWith('co-bb-river-pressure-')).map(s=>s.practiceGroup.split(':')[0]));
 const variety=mode==='strategy'?[preflop.length?`${new Set(preflop.map(s=>s.practiceNode)).size} preflop situations`:'',flopModels.length?`${new Set(flopModels.map(s=>s.board.slice(0,3).sort().join(''))).size} starting flops`:'',riverModels.size?`${riverModels.size} river-only models`:''].filter(Boolean).join(' · '):'';
 $('pool-count').textContent=mode==='strategy'?`${n} hand decisions · ${variety}`:hand?`${readyHandSpots().length} ready decisions across ${n} hands`:`${n} available decisions · L${Practice.level(records)} unlocked`;
 $('apply').disabled=!n;$('apply').textContent=hand?'Deal a ready decision':'Deal a new spot';$('hand-pool-setting').hidden=true;
 $('reviewed-hand-option').disabled=!strategyCatalogue.nodeCount;
 const guided=isGuidedMode();
 for(const id of ['profile-setting','difficulty-setting','continuation-setting'])$(id).hidden=guided||hand;
 $('strategy-feedback-setting').hidden=true;
 $('history-focus-option').hidden=guided;$('history-focus-option').disabled=guided;
 $('preflop-focus-option').hidden=false;$('preflop-focus-option').disabled=false;
 $('guided-controls').hidden=!guided;
 for(const focus of ['all','preflop','postflop','pressure'])$('guided-'+focus).setAttribute('aria-pressed',String($('focus').value===focus));
 $('pressure-focus-option').hidden=!guided;$('pressure-focus-option').disabled=!guided;
 $('guided-note').hidden=!guided;
 $('drill-mix').hidden=hand||['solved','strategy'].includes(mode);$('replay-note').hidden=!hand;
 const coverage=hand?handCoverage():null;
 $('mode-description').textContent=hand?`${coverage.ready.length} ready decisions · ${coverage.waiting.length} awaiting coverage. Independent spots; full history shown.`:mode==='strategy'?'Ten graded decisions, then a personal review.':mode==='solved'?'Three solved river decisions · declared model ranges.':'One decision at a time, with coaching.';

}
function begin(missed=false){if(transferBusy)return;$('settings').hidden=true;$('settings-toggle').setAttribute('aria-expanded','false');$('play-panel').classList.remove('settings-open');missMode=missed;if(missed&&!isGuidedMode())$('practice-mode').value='drill';mix=[];next();showView('train');resetHandView();}
function next(forced){
 if(transferBusy)return;
 strategyContinuation=null;
 clearTimeout(replayTimer);replayRun=null;terminalReveals=null;simRun=null;
 if(forced?.sourceType==='history'){dealReadyHand(forced.handId,forced);return;}
 if(forced){$('practice-mode').value=forced.sourceType==='solver-practice'?'strategy':forced.sourceType==='solver-model'?'solved':'drill';if(forced.sourceType==='solver-practice'){$('profile').value='online';$('difficulty').value='1';if(!['all',forced.area].includes($('focus').value)&&!($('focus').value==='postflop'&&forced.board.length)&&!($('focus').value==='pressure'&&forced.pressureKind))$('focus').value='all';}if(forced.sourceType==='solver-model'){$('profile').value='online';$('focus').value='river';$('difficulty').value='1';}}
 if(isGuidedMode()){if(!guidedSetId)guidedSetId=decisionId();if(showSetReview())return;}
 $('set-review').hidden=true;$('play-panel').classList.remove('set-complete');
 if(isHandMode()){dealReadyHand();return;}
 let pool=selectedPool();
 if(missMode){const missed=new Set((isGuidedMode()?GuidedPractice.mistakes(guidedRecords(),pool):session.filter(r=>r.grade==='review'&&!r.strategy&&r.sourceType!=='solver-model')).map(r=>r.spotId));const reviewPool=pool.filter(s=>missed.has(s.id));if(reviewPool.length)pool=reviewPool;else missMode=false;}
 if(!mix.length)mix=Practice.mix();
 const spot=forced||($('practice-mode').value==='strategy'?GuidedPractice.pick(pool,guidedRecords(),recent,StrategyReview):Practice.pick(pool,records,imports,mix.shift(),recent));
 if(!spot){emptyTable();return;}
 guidedAttempt=spot.sourceType==='solver-practice'?GuidedPractice.attempt(spot,guidedRecords(),!!forced||missMode):null;
 guidedSetCountable=!forced||!currentSet().records.some(r=>r.spotId===spot.id);
 current=strategyCatalogue.match(spot,PokerTable.state(spot),StrategyReview.context(spot))?structuredClone(spot):Practice.variation(spot);table=PokerTable.state(current);recent.push(spot.id);answered=false;rep++;
 clockStart=performance.now();clockElapsed=0;render();resetHandView();
}
function nextHand(){
 if(transferBusy)return;
 next();
 resetHandView();
}
function resetHandView(){
 if(!current&&$('set-review').hidden)return;
 const reset=++handViewReset;
 requestAnimationFrame(()=>{
  if(reset!==handViewReset||$('train').hidden)return;
  if(isGuidedMode()&&!$('set-review').hidden){window.scrollTo({top:0,behavior:'instant'});return;}
  if(!current)return;
  if((isGuidedMode()||isReadyHandMode())&&answered){window.scrollTo({top:Math.max(0,$('feedback').getBoundingClientRect().top+window.scrollY-12),behavior:'instant'});return;}
  // Frame the playing surface after layout. Include the footer on phones and
  // use the visible viewport, so browser chrome cannot hide the last controls.
  const mobile=window.matchMedia('(max-width: 600px)').matches;
  const viewport=window.visualViewport,height=viewport?.height||window.innerHeight,offset=viewport?.offsetTop||0;
  const anchor=mobile&&isGuidedMode()&&!$('guided-controls').hidden?$('guided-controls'):$('table-wrap');
  const controls=mobile?$('hand-navigation'):$('actions'),inset=mobile?16:12;
  const anchorTop=anchor.getBoundingClientRect().top+window.scrollY;
  const controlsBottom=controls.getBoundingClientRect().bottom+window.scrollY;
  const top=Math.max(0,anchorTop-12-offset,controlsBottom-height+inset-offset);
  window.scrollTo({top,behavior:'instant'});
 });
}
function emptyTable(){
 $('play-panel').classList.remove('decision-active');
 current=null;table=null;answered=true;countPool();$('simulation-note').hidden=true;
 $('spot-heading').textContent='No matching hands';$('ask').textContent='Try another practice setting';
 $('game-tag').textContent='PRACTICE';$('turn-label').textContent='CHOOSE A GAME';
 $('board').innerHTML=cards([],5);$('seats').innerHTML='';$('street-bets').innerHTML='';$('history').innerHTML='';$('pot').textContent='—';
 $('history-full').innerHTML='';setHistoryExpanded(false);
 for(const id of ['pot-cash','street','format','effective','last-action','history-summary'])$(id).textContent='';
 $('opponent-note').hidden=true;$('bet-controls').hidden=true;$('feedback').hidden=false;$('feedback').className='feedback unscored';
 $('feedback').innerHTML='<p>No complete hands match these filters. Choose Online + live, another focus or level, or open Explore → Coaching scenarios for live practice.</p>';
 if(isHandMode()){$('spot-heading').textContent='No ready decisions in this selection';$('feedback').innerHTML='<p>Your hands are retained. Only decisions with validated action values enter My Hands. Try All in the focus filter, or use Practice while coverage expands. Upload and coverage details are in My training.</p>';}
 document.querySelectorAll('[data-action]').forEach(b=>b.disabled=true);$('next').disabled=true;$('skip').disabled=true;
}
function startReplay(hand){
 if(transferBusy)return;
 strategyContinuation=null;
 clearTimeout(replayTimer);terminalReveals=null;simRun=null;replayRun=HandReplay.start(hand);replaySessionId=decisionId();
 recent.push(hand.id);rep++;showReplayDecision();
}
function showReplayDecision(){
 current=HandReplay.current(replayRun);table=PokerTable.state(current);answered=false;
 clockStart=performance.now();clockElapsed=0;render();resetHandView();
}
function renderSeats(action='',paid=0) {
 const s=current,n=table.order.length,heroIndex=table.order.indexOf(s.hero);
 const playerMarkup=[],wagers=[];
 for(let i=0;i<n;i++){
  const p=table.seats.find(p=>p.position===table.order[i]),offset=(i-heroIndex+n)%n,theta=2*Math.PI*offset/n;
  const x=50-Math.sin(theta)*40,y=47+Math.cos(theta)*34;
  const folded=!p.active||(p.hero&&action==='fold'),street=p.street+(p.hero?paid:0),remaining=p.remaining-(p.hero?paid:0);
  let status=folded?'Folded':p.hero?(answered?'Decision made':'Your turn'):street?'In hand':'To act';
  if(!p.hero&&!folded&&!street&&current.history.at(-1)[1].includes(p.position+' checks'))status='Check';
  if(p.hero&&answered&&action)status=action==='fold'?'Fold':action==='passive'?(table.call?'Call':'Check'):table.verb==='Raise to'?'Raised':'Bet';
  if(terminalReveals)status=folded?'Folded':'Hand ended';
  const plate=`<div class="seat-plate"><span class="seat-name">${p.hero?'YOU · ':''}${esc(p.position)}</span>${folded&&!p.hero?'':`<strong class="seat-stack">${fmt(remaining)}<small> bb</small></strong>`}<span class="seat-status">${esc(status)}</span></div>`;
  const visible=terminalReveals?.[p.position];
  playerMarkup.push(`<div class="seat ${p.hero?'hero':''} ${folded?'folded':''} ${answered&&p.hero?'acted':''}" style="--x:${x.toFixed(2)}%;--y:${y.toFixed(2)}%" aria-label="${esc(p.hero?'You, '+p.position:p.position)}${folded?', folded':', '+fmt(remaining)+' big blinds remaining'}">${p.hero?`<div class="cards hole" aria-label="Your hole cards">${cards(s.hole)}</div>`:visible?.length?`<div class="cards revealed" aria-label="Revealed cards for ${esc(p.position)}">${cards(visible)}</div>`:!folded?'<div class="backs" aria-label="Hole cards face down"><span></span><span></span></div>':''}${plate}${p.position==='BTN'?'<span class="dealer" title="Dealer button" aria-label="Dealer button">D</span>':''}</div>`);
  if(street>0)wagers.push(`<span class="street-bet"><span>${p.hero?'You ('+esc(p.position)+')':esc(p.position)}</span> <strong>${fmt(street)}bb</strong></span>`);
 }
 $('seats').innerHTML=playerMarkup.join('');
 $('street-bets').innerHTML=wagers.join('')||'<span class="no-street-bets">No bets yet</span>';
}
function renderHandHistory(history,pot){
 const rows=HandContext.rows(history,pot);
 const markup=(row,i,full)=>`<li class="history-row${i===rows.length-1?' current-street':''}"><div class="history-street"><b>${esc(row.street)}</b></div><p>${esc(full?row.full:row.text)}</p><span class="history-pot" title="${row.pot===null?'Earlier action amounts were not recorded':'Pot after the actions shown, including outstanding bets'}">Pot ${row.pot===null?'—':fmt(row.pot)+'bb'}</span></li>`;
 $('history').innerHTML=rows.map((r,i)=>markup(r,i,false)).join('');
 $('history-full').innerHTML=rows.map((r,i)=>markup(r,i,true)).join('');
 return rows;
}
function render(){
 $('play-panel').classList.add('decision-active');
 $('play-panel').classList.toggle('simulation-active',!!simRun);
 const s=current;
 $('game-tag').textContent=s.sourceType==='solver-model'?'GTO LAB · RIVER MODEL':s.profile==='live'?'LIVE CASH · $1/$3':'ONLINE CASH · '+cash((s.smallBlind||(s.bb? s.bb/2:.25))/(s.bb||.5),s)+' / '+cash(1,s);
 $('spot-heading').textContent=s.hero+' vs '+(s.villain==='Table'?'the table':s.villain);
 $('rep-number').textContent=(missMode?'Review ':isGuidedMode()?'Decision ':'Hand ')+rep+(simRun?' · simulated decision '+(simRun.state.decisions+1):replayRun?' · decision '+(replayRun.index+1):'');
 $('simulation-note').hidden=!simRun;
 $('play-panel').classList.toggle('guided-active',isGuidedMode()||isReadyHandMode());$('play-panel').classList.toggle('hand-ready-active',isReadyHandMode());
 $('learning-cue').hidden=!isGuidedMode();
 $('retry-decision').hidden=true;
 if(isGuidedMode()){$('learning-topic').textContent='Practice set';$('learning-prompt').textContent='';$('learning-prompt').hidden=true;const n=currentSet().records.length;$('learning-count').textContent=guidedSetCountable?'Decision '+(n+1)+' of 10':'Retry · '+n+' of 10 complete';}
 $('next').textContent=isHandMode()&&!isReadyHandMode()?'Next hand →':'Next decision →';$('skip').textContent=isHandMode()&&!isReadyHandMode()?'Skip hand':'Skip decision';
 $('table-wrap').classList.toggle('nine',table.order.length>6);
 $('board').innerHTML=cards(s.board,5);
 $('pot').textContent='Pot now · '+fmt(table.pot)+' bb';$('pot-cash').textContent='≈ '+cash(table.pot);
 $('street').textContent=s.board.length===0?'PREFLOP':s.board.length===3?'FLOP':s.board.length===4?'TURN':'RIVER';
 $('format').textContent=table.order.length+' handed · '+(s.profile==='live'?'Live $1/$3':'Online cash');
 $('effective').textContent=(s.tableSnapshot?'Hero started ':'Starting effective ')+fmt(s.stack)+'bb · '+cash(s.stack)+' · before rake';
 $('opponent-note').hidden=!table.read;
 $('opponent-note').classList.remove('model-note');
 $('opponent-label').textContent=simRun?'Simulation':table.read?.startsWith('Drill range:')?'Range assumption':'Scenario read';
 $('opponent-read').textContent=(table.read||'').replace(/^Drill range: /,'');
 $('turn-label').textContent='YOUR TURN';$('ask').textContent=table.call?fmt(table.call)+'bb to call':'Check or bet?';
 if(table.preflop)$('ask').textContent=fmt(table.call)+'bb to call';
 $('last-action').textContent=table.highest?(table.preflop?'Blinds / prior calls in':'Facing '+(table.heroStreet?'a raise to ':'a bet of ')+fmt(table.highest)+'bb'):(s.villain==='Table'?'Action on you':s.history.at(-1)[1].split(' · ').at(-1).split(/\. (?=[A-Z])/)[0].slice(0,100));
 const historyRows=renderHandHistory(s.history,table.pot);
 const wager=historyRows.at(-1)?.wager;
 if(table.call&&wager?.potBefore>0)$('last-action').textContent+=' · '+(wager.raise?'Raise adds ':'')+Math.round(100*wager.paid/wager.potBefore)+'% of '+fmt(wager.potBefore)+'bb pot';
 setHistoryExpanded(false);
 $('history-summary').textContent=s.history.length+' street'+(s.history.length===1?'':'s')+' · pots after action';
 $('fold-action').disabled=!table.call;$('passive-action').disabled=false;
 $('passive-action').innerHTML=(table.call?`Call ${fmt(table.call)}bb`:'Check')+'<span class="key">C</span>';
 $('aggressive-action').disabled=!table.canRaise;
 $('bet-controls').hidden=!table.canRaise;
 $('bet-label').textContent=table.verb==='Raise to'?'Raise total':'Bet size';
 for(const id of ['bet-slider','bet-amount']){$(id).min=table.min;$(id).max=table.max;$(id).disabled=false;}
 $('min-label').textContent='Min '+fmt(table.min)+'bb';$('max-label').textContent='All-in '+fmt(table.max)+'bb';
 $('presets').innerHTML=PokerTable.presets(table,s.profile==='live').map(p=>`<button type="button" data-size="${p.amount}" ${p.disabled?'disabled':''}>${p.label}</button>`).join('');
 for(const id of ['increase','decrease'])$(id).disabled=false;
 renderStrategyControls();
 setAmount(s.sourceType==='solver-model'?10:table.preflop?(s.profile==='live'?5:2.5):table.highest?table.highest*3:table.pot*.5);
 document.querySelectorAll('[data-action]').forEach(b=>b.classList.remove('selected'));
 $('feedback').hidden=true;$('feedback').innerHTML='';$('next').disabled=true;$('skip').disabled=false;
 renderSeats();countPool();
}
function setAmount(value){
 amount=PokerTable.clampAmount(value,table);
 const sizes=currentStrategySizes();
 if(sizes.length)amount=sizes.reduce((best,n)=>Math.abs(n-amount)<Math.abs(best-amount)?n:best,sizes[0]);
 $('bet-slider').value=amount;$('bet-amount').value=amount;$('bet-amount').readOnly=isGuidedMode()||isReadyHandMode();
 $('bet-slider').setAttribute('aria-valuetext',table.verb+' '+fmt(amount)+' big blinds');
 const extra=PokerTable.round(amount-table.heroStreet),potPct=table.highest?null:Math.round(100*amount/table.pot);
 $('size-detail').textContent=isGuidedMode()?(table.highest?`${fmt(extra)}bb added`:`${potPct}% pot`):table.highest?`${cash(extra)} more · to ${cash(amount)}`:`${potPct}% pot · ${cash(amount)}`;
 $('aggressive-action').innerHTML=(Math.abs(amount-table.max)<.011?'All-in '+fmt(amount)+'bb':table.verb+' '+fmt(amount)+'bb')+'<span class="key">B'+(table.verb==='Raise to'?' · total this street':'')+'</span>';
 if((isGuidedMode()||isReadyHandMode())&&!sizes.length)$('aggressive-action').innerHTML=table.call?'Raise unavailable':'Bet unavailable';
 document.querySelectorAll('[data-size]').forEach(b=>b.classList.toggle('active',Math.abs(Number(b.dataset.size)-amount)<.011));
}
function setHistoryExpanded(expanded){
 $('history').hidden=expanded;$('history-full').hidden=!expanded;
 $('history-toggle').setAttribute('aria-expanded',String(expanded));$('history-toggle').textContent=expanded?'Compact':'Full log';
 $('play-panel').classList.toggle('history-open',expanded);
}
function decisionSeconds(){return (clockElapsed+(document.hidden?0:performance.now()-clockStart))/1000;}
function act(action){
 if(transferBusy)return;
 if(answered||!current||!progressReady)return;
 const button=$(action==='fold'?'fold-action':action==='passive'?'passive-action':'aggressive-action');
 if(button.disabled)return;
 if(action==='aggressive'){if(!$('bet-amount').checkValidity()){$('bet-amount').reportValidity();return;}setAmount($('bet-amount').value);}
 if(current.sourceType==='solver-model'){actSolved(action,button);return;}
 if(simRun){actSimulation(action,button);return;}
 if(replayRun){actReplay(action,button);return;}
 const strategyResult=evaluateCurrentStrategy(action);
 if(isReadyHandMode()&&strategyResult?.coverage!=='covered')return;
 answered=true;
 const evaluation=strategyResult||PokerTable.evaluate(current,action,amount),grade=evaluation.grade;
 const paid=action==='fold'?0:action==='passive'?table.call:PokerTable.round(amount-table.heroStreet);
 const choice=action==='fold'?'Fold':action==='passive'?(table.call?'Call '+fmt(table.call)+'bb':'Check'):table.verb+' '+fmt(amount)+'bb'+(Math.abs(amount-table.max)<.011?' (all-in)':'');
 const record={id:decisionId(),spotId:current.id,profile:current.profile,area:current.area,hole:current.hole.join(' '),board:current.board.join(' '),choice,preferred:current.options[current.best]||'Unsolved replay',grade,comparison:evaluation.comparison,time:new Date().toISOString(),seconds:Math.round(decisionSeconds()*10)/10,sourceType:current.sourceType||'coaching',why:current.why,heuristic:current.heuristic};
 attachStrategy(record,strategyResult);
 if(guidedAttempt&&current.sourceType==='solver-practice')record.practiceAttempt={...guidedAttempt};
 if(isGuidedMode()){const group=currentSet(),previous=group.records.findLast(r=>r.spotId===current.id);record.practiceSet={version:1,id:guidedSetId,slot:guidedSetCountable?group.records.length+1:previous.practiceSet.slot,counted:guidedSetCountable};}
 records.push(record);session.push(record);streak=grade==='good'?streak+1:0;
 document.querySelectorAll('[data-action], [data-size], #bet-slider, #bet-amount, #decrease, #increase').forEach(b=>b.disabled=true);button.classList.add('selected');
 renderSeats(action,paid);$('pot').textContent='Pot now · '+fmt(table.pot+paid)+' bb';$('pot-cash').textContent='≈ '+cash(table.pot+paid);$('turn-label').textContent='DECISION RECORDED';$('ask').textContent=choice;
 const heading=grade==='good'?'✓ On-line':grade==='reasonable'?'≈ Reasonable alternative':grade==='review'?'↺ Review this decision':current.sourceType==='history'?'Real-hand replay · unscored':'Custom sizing · unscored';
 const comparison=evaluation.comparison?`<p class="comparison">Your ${esc(choice)} was compared with the nearby authored line: ${esc(evaluation.comparison)}. This is coaching guidance, not solver precision.</p>`:'';
 const math=table.call?`<p class="math">Call price before your action: ${fmt(table.call)} ÷ (${fmt(table.pot)} + ${fmt(table.call)}) = ${(100*table.call/(table.pot+table.call)).toFixed(1)}% required equity. This is a price, not your hand's equity.</p>`:'';
 const source=current.sourceType==='history'?`<p><strong>Originally you played:</strong> ${esc(current.historicalAction)}</p>`:`<p><strong>Coaching line: ${esc(current.options[current.best])}</strong></p>`;
 $('feedback').className='feedback '+grade+(strategyResult&&GuidedPractice.impact(strategyResult).key==='small'?' small-gap':'');
 $('feedback').innerHTML=`<h3>${heading}</h3>${source}${comparison}${grade==='unscored'&&current.sourceType!=='history'?'<p>This exact size is outside the authored comparison range. It is saved without changing your score or marking a new leak.</p>':''}<p>${esc(current.why)}</p>${current.overlay?`<p><strong>Live adjustment:</strong> ${esc(current.overlay)}</p>`:''}${math}<p class="heuristic"><strong>Takeaway:</strong> ${esc(current.heuristic)}</p><span class="small muted">${esc(current.sourceType==='history'?current.handId:labels[current.area])} · ${record.seconds}s</span>`;
 if(strategyResult){$('feedback').innerHTML=strategyFeedback(strategyResult);if(isGuidedMode()){$('retry-decision').hidden=false;$('learning-count').textContent=currentSet().records.length+' of 10 complete';if(record.practiceAttempt?.kind!=='first')$('feedback').innerHTML+=`<p class="attempt-note">${record.practiceAttempt?.kind==='retest'?'Delayed check recorded separately from your first attempt.':'Practice repeat: this grade does not change your first-attempt score. A corrected mistake stays available for a delayed check.'}</p>`;}}
 if(isReadyHandMode()){
  const hand=personalHands().find(h=>h.id===current.handId),net=HandReplay.netResult(hand),original=current.recordedChoice;
  const review=original?strategyCatalogue.evaluate(current,table,currentStrategyContext(),original.action,original.amount||0):null;
  $('feedback').innerHTML+=`<section class="original-decision"><h4>How did you play it originally?</h4><p>${esc(current.historicalAction||'Original action unavailable')}</p>${review?.coverage==='covered'?`<p>Original decision EV loss: <strong>${review.lossBB.toFixed(3)}bb</strong> · ${review.lossBB<=review.evToleranceBB?'Within model tolerance':'A decision to review in this model'}.</p>`:'<p>The original action or size is outside this validated comparison.</p>'}${net!==null?`<p>Recorded result for the whole hand: <strong>${net>0?'+':''}${fmt(net)}bb</strong>.</p>`:''}<p class="small muted">The hand result and this decision’s EV loss measure different things. A low-loss decision can lose the pot; this review alone cannot establish that the entire hand was played correctly or that its loss was only variance.</p></section>`;
 }
 $('play-panel').classList.remove('decision-active');
 $('feedback').hidden=false;$('next').disabled=false;$('skip').disabled=true;
 updateStats();pending.push({route:'decisions',data:record});savePending();if(isGuidedMode())showSetReview();resetHandView();
}
function actReplay(action,button){
 const strategyResult=evaluateCurrentStrategy(action);
 const before=current,index=replayRun.index,result=HandReplay.choose(replayRun,action,amount,table);
 answered=true;
 const choice=action==='fold'?'Fold':action==='passive'?(table.call?'Call '+fmt(table.call)+'bb':'Check'):table.verb+' '+fmt(amount)+'bb';
 const paid=action==='fold'?0:action==='passive'?table.call:PokerTable.round(amount-table.heroStreet);
 const record={id:decisionId(),spotId:before.id,handId:before.handId,handSessionId:replaySessionId,mode:'hand',
  profile:before.profile,area:before.area,hole:before.hole.join(' '),board:before.board.join(' '),choice,grade:'unscored',
  preferred:'Unsolved historical replay',originalAction:before.historicalAction,matchedHistory:result.choice.matched,replayStatus:result.status,
  time:new Date().toISOString(),seconds:Math.round(decisionSeconds()*10)/10,sourceType:'history',decisionState:StrategyReview.state(before,table),why:before.why,heuristic:before.heuristic};
 if(result.status==='diverged'&&$('continuation').value==='practice'){
  try{
   const state=PokerSim.fromHand(replayRun.hand,index,crypto.getRandomValues(new Uint32Array(1))[0]);
   PokerSim.act(state,state.hero,action,amount);PokerSim.advance(state,PracticeOpponents);
   simRun={hand:replayRun.hand,state,sessionId:replaySessionId};Object.assign(record,simulationMetadata(),{mode:'simulation',sourceType:'simulation',preferred:'Unsolved practice simulation',why:'This alternative line uses practice opponents, sampled holdings and newly dealt future cards.',heuristic:'Judge the decision from the available information; a simulated win or loss is not a GTO grade.'});
   attachSimulationResult(record);
  }catch(error){replayRun.simulationError=error.message;}
 }
 attachStrategy(record,strategyResult);
 records.push(record);session.push(record);
 result.choice.label=choice;result.choice.street=before.board.length===0?'Preflop':before.board.length===3?'Flop':before.board.length===4?'Turn':'River';
 document.querySelectorAll('[data-action], [data-size], #bet-slider, #bet-amount, #decrease, #increase').forEach(b=>b.disabled=true);
 button.classList.add('selected');renderSeats(action,paid);$('pot').textContent='Pot now · '+fmt(table.pot+paid)+' bb';$('pot-cash').textContent='≈ '+cash(table.pot+paid);
 $('turn-label').textContent='YOUR ACTION';$('ask').textContent=choice;$('skip').disabled=false;
 updateStats();pending.push({route:'decisions',data:record});savePending();
 const advance=()=>{
  if(simRun){queueSimulation();}
  else if(result.status==='playing'){
   $('last-action').textContent='Continuing the hand…';
   replayTimer=setTimeout(()=>{if(replayRun?.status==='playing')showReplayDecision();},700);
  }else {renderReplayEnd();resetHandView();}
 };
 if(!pauseForStrategy(record,advance))advance();
}
function simulationMetadata(){return {handId:simRun.hand.id,handSessionId:simRun.sessionId,simulationVersion:PokerSim.VERSION,simulationPolicy:PracticeOpponents.id,simulationSeed:simRun.state.seed,branchIndex:simRun.state.branchIndex,simulationDecision:simRun.state.decisions};}
function attachSimulationResult(record){
 const s=simRun.state;if(s.status!=='complete')return;
 const hero=s.players.find(p=>p.hero);
 record.simulationResult={board:[...s.board],awards:structuredClone(s.awards),pot:s.settledPot/100,heroNet:(hero.remaining-hero.start)/100,rake:0};
}
function queueSimulation(){
 const run=simRun;$('last-action').textContent='Practice opponents are playing…';$('simulation-note').hidden=false;
 replayTimer=setTimeout(()=>{if(simRun===run)showSimulation();},700);
}
function startSimulation(hand,index,seed){
 if(transferBusy)return;
 strategyContinuation=null;
 // Build before replacing the current hand so an unsupported import leaves it intact.
 let state;try{state=PokerSim.fromHand(hand,index,seed);}catch(error){$('backup-status').textContent='Cannot retry this branch: '+error.message;return;}
 clearTimeout(replayTimer);replayRun=null;terminalReveals=null;simRun={hand,state,sessionId:decisionId()};
 missMode=false;$('practice-mode').value='hand';rep++;showSimulation();showView('train');
}
function showSimulation(){
 current=PokerSim.snapshot(simRun.state);table=PokerTable.state(current);answered=false;
 clockStart=performance.now();clockElapsed=0;render();
 if(simRun.state.status==='complete')renderSimulationEnd();
 resetHandView();
}
function actSimulation(action,button){
 const strategyResult=evaluateCurrentStrategy(action);
 const before=current,seconds=Math.round(decisionSeconds()*10)/10;
 const choice=action==='fold'?'Fold':action==='passive'?(table.call?'Call '+fmt(table.call)+'bb':'Check'):table.verb+' '+fmt(amount)+'bb';
 const paid=action==='fold'?0:action==='passive'?table.call:PokerTable.round(amount-table.heroStreet);
 // Mutate a copy: a rejected action cannot damage the live hand or create a saved decision.
 const state=structuredClone(simRun.state);
 try{PokerSim.act(state,state.hero,action,amount);PokerSim.advance(state,PracticeOpponents);}
 catch(error){$('feedback').hidden=false;$('feedback').className='feedback unscored';$('feedback').textContent='Simulation paused: '+error.message;return;}
 simRun.state=state;answered=true;
 const record={id:decisionId(),spotId:before.id,...simulationMetadata(),mode:'simulation',sourceType:'simulation',profile:before.profile,area:before.area,hole:before.hole.join(' '),board:before.board.join(' '),choice,preferred:'Unsolved practice simulation',grade:'unscored',time:new Date().toISOString(),seconds,decisionState:StrategyReview.state(before,table),why:before.why,heuristic:before.heuristic};
 attachStrategy(record,strategyResult);
 attachSimulationResult(record);records.push(record);session.push(record);
 document.querySelectorAll('[data-action], [data-size], #bet-slider, #bet-amount, #decrease, #increase').forEach(b=>b.disabled=true);
 button.classList.add('selected');renderSeats(action,paid);$('pot').textContent='Pot now · '+fmt(table.pot+paid)+' bb';$('pot-cash').textContent='≈ '+cash(table.pot+paid);
 $('turn-label').textContent='YOUR ACTION';$('ask').textContent=choice;
 updateStats();pending.push({route:'decisions',data:record});savePending();
 if(!pauseForStrategy(record,queueSimulation))queueSimulation();
}
function renderSimulationEnd(){
 $('play-panel').classList.remove('decision-active');
 const s=simRun.state,hero=s.players.find(p=>p.hero),net=(hero.remaining-hero.start)/100,decisionReview=handStrategyReview(simRun.sessionId),hasSolutions=handStrategyCount(simRun.sessionId)>0;
 answered=true;terminalReveals=s.players.filter(p=>p.active).length>1?Object.fromEntries(s.players.filter(p=>p.active).map(p=>[p.position,p.hole])):{};
 renderSeats();$('turn-label').textContent=hero.active?'SIMULATION FINISHED':'YOU FOLDED';$('ask').textContent='Review your alternative line';
 $('rep-number').textContent='Hand '+rep+' · simulation finished';$('last-action').textContent=decisionReview?'Decision feedback below':'Practice simulation · unscored';$('street').textContent='SIMULATED FINISH';
 $('pot').textContent=fmt(s.settledPot/100)+' bb';$('pot-cash').textContent='Final pot · no rake simulated';$('bet-controls').hidden=true;
 document.querySelectorAll('[data-action], [data-size], #bet-slider, #bet-amount, #decrease, #increase').forEach(b=>b.disabled=true);
 const choices=s.actions.filter(a=>a.position===s.hero).map(a=>`<li>${esc(a.street)}: ${esc(a.label)}</li>`).join('');
 const awards=s.awards.map(a=>`${a.position===s.hero?'You':a.position} collected ${fmt(a.amount)}bb (${a.hand})`).join(' · ');
 const hand=simRun.hand,index=s.branchIndex,seed=s.seed;
 $('feedback').className='feedback unscored';$('feedback').hidden=false;
 $('feedback').innerHTML=`<h3>Alternative line${hasSolutions?'':' · unscored'}</h3><p>${esc(awards)}.</p><p>Your simulated net result: <strong>${net>0?'+':''}${fmt(net)}bb</strong>, before rake. The sampled opponents and runout differ from the original hand; this result does not establish that a decision was better.</p><ol>${choices}</ol>${decisionReview}<p><strong>Review prompt:</strong> What range and price justified each decision?</p><details class="original-finish"><summary>Compare with the original hand</summary><p>At the branch, originally: ${esc(hand.spots[index].historicalAction)}</p><div class="cards">${cards(hand.replay.terminal.board)}</div>${originalFinish(hand)}</details><p><button data-sim-again class="secondary">Retry this branch</button> <button data-replay-again class="text-button">Replay from preflop</button></p><span class="small muted">Same seed on retry; opponents can respond differently when your actions change.</span>`;
 $('feedback').querySelector('[data-sim-again]').onclick=()=>startSimulation(hand,index,seed);
 $('feedback').querySelector('[data-replay-again]').onclick=()=>startReplay(hand);
 $('next').disabled=false;$('skip').disabled=true;
}
function originalFinish(hand){
 const end=hand.replay.terminal,net=PokerTable.round(end.heroWon-end.heroInvested);
 const winners=end.awards.map(a=>(a.position===hand.spots[0].hero?'You':a.position)+' collected '+fmt(a.amount)+'bb').join(' · ');
 return `<p>${esc(winners)}. Fees: ${fmt(end.charges)}bb.</p><p>Your original net result: <strong>${net>0?'+':''}${fmt(net)}bb</strong>. The result does not establish whether the decisions were good.</p>`;
}
function renderReplayEnd(){
 $('play-panel').classList.remove('decision-active');
 const run=replayRun,hand=run.hand,end=hand.replay.terminal,complete=run.status==='complete',decisionReview=handStrategyReview(replaySessionId),hasSolutions=handStrategyCount(replaySessionId)>0;
 $('turn-label').textContent=run.status==='folded'?'YOU FOLDED':complete?'HAND FINISHED':'NEW LINE';
 $('ask').textContent=complete?'Review your decisions':run.status==='folded'?'Your hand ends here':'Your choice changes the hand';
 $('last-action').textContent=decisionReview?'Decision feedback below':'Historical replay · unscored';$('bet-controls').hidden=true;
 if(complete){
  current={...current,board:end.board,history:end.history};
  table={...table,seats:end.seats.map(p=>({...p,street:0,remaining:p.remaining+end.awards.filter(a=>a.position===p.position).reduce((n,a)=>n+a.amount,0)}))};
  terminalReveals=end.reveals;renderSeats();
  $('board').innerHTML=cards(end.board,5);$('street').textContent='RECORDED FINISH';$('pot').textContent='Final pot · '+fmt(end.pot)+' bb';$('pot-cash').textContent='Final pot · before fees';
  renderHandHistory(end.history,end.pot);
  $('history-summary').textContent='Complete recorded action · sizes in bb';
 }
 const comparison=run.choices.map(c=>`<tr><th scope="row">${esc(c.street)}</th><td>${esc(c.label)}</td><td>${esc(c.original.replace(/^[^:]+: /,''))}</td></tr>`).join('');
 const explanation=complete?'You reached the end of your recorded decisions. Following the original line is not a GTO grade.':run.status==='folded'?(hasSolutions?'Folding ends your participation. Compare action values in the decision breakdown.':'Folding ends your participation. Whether it improves on the old decision needs a reviewed strategy.'):run.simulationError?'This imported position could not be simulated: '+esc(run.simulationError):'Historical comparison is selected. In Practice settings, choose Continue with practice opponents to play a changed line through to its simulated finish.';
 const source=complete?originalFinish(hand):`<details class="original-finish"><summary>See how the original hand finished</summary><div class="cards">${cards(end.board)}</div>${originalFinish(hand)}</details>`;
 $('feedback').className='feedback unscored';$('feedback').hidden=false;
 $('feedback').innerHTML=`<h3>${complete?'Hand review':'Decision comparison'}${hasSolutions?'':' · unscored'}</h3><p>${explanation}</p><div class="comparison-scroll"><table class="replay-comparison"><thead><tr><th>Street</th><th>This time</th><th>Originally</th></tr></thead><tbody>${comparison}</tbody></table></div>${decisionReview}${source}<p><strong>Review prompt:</strong> ${esc(HandReplay.current(run).heuristic)}</p><span class="small muted">Original hand ${esc(hand.id)} · ${esc(hand.date)}</span><p><button data-replay-again class="secondary">Replay from preflop</button></p>`;
 $('feedback').querySelector('[data-replay-again]').onclick=()=>startReplay(hand);
 $('next').disabled=false;$('skip').disabled=true;
}
function updateStats(){
 const guided=guidedRecords(session),guidedSummary=GuidedPractice.summary(guided),scored=session.filter(r=>r.grade!=='unscored'&&!r.strategy&&r.sourceType!=='solver-model'),good=scored.filter(r=>r.grade==='good').length;
 $('answered').textContent=session.length;$('accuracy').textContent=scored.length?Math.round(good/scored.length*100)+'%':'—';$('streak').textContent=streak;$('review-count').textContent=records.length;
 if(isGuidedMode()){$('answered').textContent=guidedSummary.count;$('accuracy').textContent=guidedSummary.firstCount?Math.round(guidedSummary.firstGood/guidedSummary.firstCount*100)+'%':'—';$('accuracy-label').textContent='first attempts · low loss';$('streak').textContent=guidedSummary.firstCount?fmt(guidedSummary.firstAverage)+'bb':'—';$('streak-label').textContent='first-attempt EV loss';}else{$('accuracy-label').textContent='coaching on-line';$('streak-label').textContent='streak';}
 $('export').disabled=!session.length;
 $('session-dots').innerHTML=session.slice(-30).map(r=>`<span class="dot ${r.grade}" title="${esc(labels[r.area]+': '+r.grade)}"></span>`).join('');
 $('session-caption').textContent=session.length?`${good} coaching on-line · ${scored.filter(r=>r.grade==='reasonable').length} reasonable · ${scored.filter(r=>r.grade==='review').length} to review · ${session.filter(r=>r.strategy?.coverage==='covered'||r.solution?.coverage==='solved-model').length} solution grades · ${session.filter(r=>r.grade==='unscored').length} unscored`:'Your decisions will appear here.';
 if(isGuidedMode())$('session-caption').textContent=guidedSummary.count?`${guidedSummary.firstCount} first attempts · ${guidedSummary.retryCount} practice repeats · ${guidedSummary.retestCount} delayed checks. ${guidedSummary.retestCount?guidedSummary.retestGood+' low-loss delayed checks.':'Delayed checks begin after a day and other practice.'}`:'Consider the ranges, choose an action, then review the takeaway.';
 const missed=isGuidedMode()?GuidedPractice.mistakes(guidedRecords(),selectedPool()):session.filter(r=>r.grade==='review'&&r.sourceType!=='solver-model'&&!r.strategy),counts={};missed.forEach(r=>counts[r.area]=(counts[r.area]||0)+1);
 $('review-misses').disabled=!missed.length;$('mistake-list').innerHTML=Object.entries(counts).map(([key,n])=>`<div class="mistake">${labels[key]}<span>${n} to revisit later</span></div>`).join('');
 renderProgress();renderSources();
}
function renderProgress(){
 const s=Practice.stats(records),timed=records.filter(r=>r.grade==='good'||r.grade==='reasonable').map(r=>r.seconds).filter(Number.isFinite).sort((a,b)=>a-b);
 const median=timed.length?timed[Math.floor(timed.length/2)]+'s':'—';
 const saved=records.filter(r=>savedDecisionIds.has(r.id)).length,unsaved=records.length-saved;
 $('review-summary').textContent=`${saved} saved decisions · ${unsaved} awaiting save${storedProgressLoaded?'':' · earlier progress not loaded'}`;
 $('progress-cards').innerHTML=`<div class="progress-card"><strong>L${Practice.level(records)}</strong><span>Current gradual level</span></div><div class="progress-card"><strong>${s.count?Math.round(s.accuracy*100)+'%':'—'}</strong><span>On-line or reasonable · latest 12</span></div><div class="progress-card"><strong>${median}</strong><span>Median time · sound decisions</span></div>`;
 renderSolverProgress();
 const guided=guidedRecords(),summary=GuidedPractice.summary(guided);
 if(summary.count){$('progress-cards').innerHTML=`<div class="progress-card"><strong>${summary.firstCount}</strong><span>First attempts on distinct decisions</span></div><div class="progress-card"><strong>${summary.firstCount?Math.round(summary.firstGood/summary.firstCount*100)+'%':'—'}</strong><span>Low-loss first attempts</span></div><div class="progress-card"><strong>${summary.firstCount?fmt(summary.firstAverage)+'bb':'—'}</strong><span>Average first-attempt EV loss</span></div>`;}
 const open=GuidedPractice.mistakes(guided,guidedPracticeSpots),due=open.filter(r=>r.due).length;
 const completed=GuidedPractice.sets(guided).filter(g=>g.records.length===10).slice(-5).reverse();
 $('completed-sets').hidden=!completed.length;$('completed-sets').innerHTML='<h2>Completed sets</h2>'+completed.map(g=>`<details class="completed-set"><summary>10 decisions · ${esc(new Date(g.records.at(-1).time).toLocaleDateString())} · ${g.records.filter(r=>r.grade==='good').length} low-loss choices</summary>${setReport(g)}</details>`).join('');
 $('learning-progress').hidden=!summary.count;
 $('learning-progress').textContent=`${summary.retryCount} practice repeats · ${summary.retestCount} delayed checks${summary.retestCount?' ('+summary.retestGood+' low-loss)':''}. ${open.length} mistakes remain for later review${due?' · '+due+' ready for a delayed check':''}. A delayed check needs at least a day and three other decisions. This measures recall of that spot, not mastery on new boards.`;
 $('gto-progress').hidden=!!summary.count&&!records.some(r=>r.sourceType==='solver-model');
 $('backup-export').disabled=transferBusy||!progressReady;
 $('backup-export').textContent=!storedProgressLoaded||unsaved?'Download backup / unsaved work':'Download backup';
 $('backup-restore-label').hidden=false;$('backup-restore').disabled=transferBusy||!progressReady;
 $('save-help').textContent=unsaved?'Some decisions are not saved. Open Progress to retry or download a recovery file before closing this tab.':!storedProgressLoaded?'Earlier progress could not be loaded. Open Progress to retry.':'Your recorded decisions are saved. Download a backup before changing devices or hosting.';
 $('review-list').innerHTML=[...records].reverse().slice(0,100).map(reviewRecord).join('');
}
function reviewRecord(r){
 const simulation=r.mode==='simulation',badge=r.sourceType==='solver-practice'?(r.practiceAttempt?.kind==='first'?'First attempt':r.practiceAttempt?.kind==='retest'?'Delayed check':r.practiceAttempt?'Practice repeat':'Earlier practice'):r.mode==='solved'?'Solved model':simulation?'Simulation':r.mode==='hand'?'Hand replay':r.profile==='live'?'Live':'Online';
 const retry=simulation?`<button class="text-button" data-sim-record="${esc(r.id)}">Retry this branch →</button>`:`<button class="text-button" data-replay="${esc(r.spotId)}">Practice this spot again →</button>`;
 const result=r.simulationResult?`<p>Simulated net: ${fmt(r.simulationResult.heroNet)}bb before rake · not a strategy grade.</p>`:'';
 return `<details class="review-item"><summary><span class="badge">${badge}</span><span class="${esc(r.grade)}">${esc(r.choice)}</span> · ${esc(r.hole?.replace(/([shdc])/g,c=>suits[c]))} · ${esc(r.seconds??'—')}s</summary><p>${esc(r.board||'Preflop')} · ${esc(r.grade)} · ${esc(r.time.slice(0,10))}</p><p><strong>${['history','simulation','solver-model','solver-practice'].includes(r.sourceType)?'Reference':'Coaching line'}:</strong> ${esc(r.preferred)}</p>${r.originalAction?`<p>Originally: ${esc(r.originalAction)}</p>`:''}${r.strategy&&strategyCatalogue.validRecord(r)?'':`<p>${esc(r.why)}</p><p>${esc(r.heuristic)}</p>`}${result}${r.strategy&&strategyCatalogue.validRecord(r)?strategyFeedback(r.strategy):''}${r.mode==='solved'&&SolverGrades.validRecord(r)?solverFeedback(r.solution):''}${r.handId?`<button class="text-button" data-replay-hand="${esc(r.handId)}">Practise ready decisions →</button>`:''}${retry}</details>`;
}
function renderSources(){
 const hands=imports.filter(i=>i.kind==='hand'),reports=imports.filter(i=>i.kind==='report');
 const coverage=handCoverage();
 $('hand-coverage').innerHTML=`<h2>Your hand coverage</h2><p>${coverage.ready.length} ready decisions · ${coverage.waiting.length} awaiting coverage.</p><p>Imports stay on this device. Personal-hand solver reviews are not published with this public site. Keep a backup of your hands and progress.</p>`;
 $('source-summary').textContent=`${hands.length} imported hands · ${allSpots().filter(s=>s.sourceType!=='history').length} authored drills`;
 const topics=[...new Set(reports.flatMap(r=>r.themes||[]))];
 $('focus-cards').innerHTML=topics.map(area=>`<div class="focus-card"><strong>${esc(labels[area])}</strong><p>Suggested by your review notes; confirm through practice.</p></div>`).join('');
 $('source-list').innerHTML='<div class="source-item"><h3>Your practice data</h3><p>Hands, review notes and results stay in this browser. They are not uploaded to GitHub. Use a backup to move them to another browser or device; clearing site data can erase them.</p></div>'+imports.map(i=>`<div class="source-item"><h3>${esc(i.name)}</h3><p>${i.kind==='hand'?`${i.spots.length} replay decisions · unscored`:i.kind==='drill-pack'?`${i.spots.length} restored authored drills`:esc(i.summary)}</p>${i.kind==='report'?`<details><summary>Review text</summary><p style="white-space:pre-wrap">${esc(i.text)}</p></details>`:''}</div>`).join('');
}

function showView(name){document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==name);document.querySelectorAll('.nav[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));if(name==='review')renderProgress();}
async function api(route,data){return LocalPractice.api(route,data);}
async function loadProgress(){
 const data=await api('progress');
 if(!Array.isArray(data.records)||!Array.isArray(data.imports))throw new Error('Saved progress could not be read.');
 data.records.forEach(r=>savedDecisionIds.add(r.id));
 records=mergeData(records,data.records).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 imports=mergeData(data.imports,imports);storedProgressLoaded=true;
 // A timed-out write may already be saved. Its stable ID makes retries safe.
 pending=pending.filter(p=>p.route!=='decisions'||!savedDecisionIds.has(p.data.id));
}
async function savePending(){
 if(saving)return;
 saving=true;$('save-status').textContent='Saving…';
 try{
  while(pending.length){const next=pending[0],result=await api(next.route,next.data);if(result.saved!==true)throw new Error('Save was not acknowledged.');if(next.route==='decisions')savedDecisionIds.add(next.data.id);pending.shift();}
  $('save-status').textContent=storedProgressLoaded?'Progress saved':'New work saved · earlier progress not loaded';$('retry-save').hidden=storedProgressLoaded;
 }catch(error){$('save-status').textContent='Not saved · open Progress';$('retry-save').hidden=false;$('retry-save').title=error.message;}
 finally{saving=false;renderProgress();}
}
async function retryProgress(){
 if(saving||transferBusy)return;
 try{await loadProgress();await savePending();updateStats();}
 catch(error){$('save-status').textContent='Progress unavailable · open Progress';$('retry-save').hidden=false;$('backup-status').textContent=error.message+' Download unsaved work before closing this tab.';renderProgress();}
}
async function boot(){
 try{await loadProgress();$('save-status').textContent='Saved on this device';$('retry-save').hidden=true;}
 catch{$('save-status').textContent='Progress unavailable · open Progress';$('retry-save').hidden=false;}
 $('strategy-feedback-setting').hidden=true;$('strategy-mode-option').hidden=!guidedPracticeSpots.length;if(!guidedPracticeSpots.length&&isGuidedMode())$('practice-mode').value='drill';if(guidedPracticeSpots.length)$('practice-mode').value='strategy';$('backup-restore').disabled=false;progressReady=true;$('import-files').disabled=false;guidedSetId=GuidedPractice.sets(guidedRecords()).at(-1)?.id||decisionId();updateStats();countPool();next();
}
async function importFiles(event){
 if(!progressReady||transferBusy||importBusy)return;
 const files=[...event.target.files];if(!files.length)return;
 importBusy=true;try{
 $('import-status').textContent='Reading files…';let added=0,upgraded=0,duplicates=0,warnings=[];
 for(const file of files){
  try{
   if(file.size>1000000)throw new Error(file.name+': split exports into files under 1 MB for in-app import.');
   const text=await file.text();
   if(/Poker Hand #/.test(text)){
    const parsed=GGImport.parse(text,file.name);warnings.push(...parsed.warnings);
    for(const hand of parsed.hands){
     if(SEED_HANDS.some(h=>h.id===hand.id)||REPLAY_HANDS.some(h=>h.id===hand.id)){duplicates++;continue;}
     const existing=imports.findIndex(i=>i.id===hand.id);
     if(existing>=0){
      if(imports[existing].kind==='hand'&&!imports[existing].replay&&HandReplay.available(hand)){
       const item={...imports[existing],...hand,name:file.name};imports[existing]=item;pending.push({route:'imports',data:item});upgraded++;
      }else duplicates++;
      continue;
     }
     const item={id:hand.id,kind:'hand',name:file.name,...hand};imports.push(item);pending.push({route:'imports',data:item});added++;
    }
   }else{
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)),id='report-'+[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    if(imports.some(i=>i.id===id)){duplicates++;continue;}
    const item={id,...GGImport.report(text,file.name)};imports.push(item);pending.push({route:'imports',data:item});added++;
   }
  }catch(error){warnings.push(error.message);}
 }
 renderSources();countPool();if(!current)next();await savePending();
 $('import-status').textContent=`${added} added · ${upgraded} upgraded to full replay · ${duplicates} duplicates skipped. ${pending.length?'Some imports are not yet saved; keep this tab open and use Retry saving in Progress. ':''}${warnings.slice(0,5).join(' ')}${warnings.length>5?` (+${warnings.length-5} more skipped exports)`:''}`;
 }finally{importBusy=false;}
}
function downloadJSON(data,name){
 const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function backupData(){
 if(!storedProgressLoaded)throw new Error('Load saved progress before downloading a complete backup.');
 const hands=allReplayHands().map(h=>({...h,kind:'hand',name:h.name||h.filename||'Practice hand'}));
 const coached=SPOTS.map(s=>({...s,tableSnapshot:{...PokerTable.state(s),active:[...PokerTable.state(s).active].filter(p=>PokerTable.state(s).order.includes(p))}}));
 const bundled=[];
 const items=[{id:'authored-practice',kind:'drill-pack',name:'Authored coaching',spots:coached},...bundled,...hands,...imports];
 return JSON.parse(JSON.stringify({format:'kaizen-gto-backup',version:1,exportedAt:new Date().toISOString(),records,imports:[...new Map(items.map(i=>[i.id,i])).values()]}));
}
function mergeData(remote,local){
 const result=new Map(remote.map(i=>[i.id,i]));
 for(const item of local){const old=result.get(item.id);if(!old||!(old.kind==='hand'&&old.replay&&!item.replay))result.set(item.id,item);}
 return [...result.values()];
}
function recoveryData(){
 return PracticeBackup.validate(JSON.parse(JSON.stringify({format:'kaizen-gto-backup',version:1,scope:'recovery',exportedAt:new Date().toISOString(),records,imports})));
}
$('backup-export').onclick=async()=>{
 if(transferBusy||importBusy){$('backup-status').textContent='Finish the current import or transfer first.';return;}
 transferBusy=true;$('backup-export').disabled=true;
 try{
  let complete=true;try{await loadProgress();}catch{complete=false;}
  const data=complete?PracticeBackup.validate(backupData()):recoveryData();
  downloadJSON(data,'kaizen-gto-'+(complete?'backup':'recovery')+'-'+new Date().toISOString().slice(0,10)+'.json');
  $('backup-status').textContent=complete?'Backup downloaded, including work awaiting save. It contains personal histories and practice results.':'Recovery file downloaded with the work available in this tab. Earlier work on the server may be missing. Restore this file after the connection recovers.';
 }catch(error){$('backup-status').textContent='Download failed: '+error.message;}
 finally{transferBusy=false;updateStats();}
};
$('backup-restore').onchange=async event=>{
 const file=event.target.files[0];if(!file||!progressReady||transferBusy||saving)return;
 if(importBusy){$('backup-status').textContent='Finish the current import first.';return;}
 transferBusy=true;renderProgress();
 try{
  if(file.size>50000000)throw new Error('Backup exceeds the 50 MB restore limit.');
  const data=PracticeBackup.validate(JSON.parse(await file.text()));
  await loadProgress(); // Merge only after confirming the account's existing data.
  const known=new Set(records.map(r=>r.id)),handIds=new Set([...SEED_HANDS,...REPLAY_HANDS].map(h=>h.id));let added=0;
  for(const r of data.records)if(!known.has(r.id)){records.push(r);pending.push({route:'decisions',data:r});known.add(r.id);added++;}
  for(const item of data.imports){
   if(item.kind==='drill-pack'||handIds.has(item.id))continue;
   const index=imports.findIndex(i=>i.id===item.id),existing=imports[index];
   if(existing){if(existing.kind!=='hand'||existing.replay||item.kind!=='hand'||!item.replay)continue;imports[index]=item;}
   else imports.push(item);
   pending.push({route:'imports',data:item});
  }
  records.sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));await savePending();
  $('backup-status').textContent=pending.length?'Recovered work is in this tab but still awaits saving. Keep your recovery file and retry.':`Restored ${added} new decisions. Existing records were preserved.`;
  updateStats();countPool();
 }catch(error){$('backup-status').textContent='Restore failed: '+error.message;}
 finally{transferBusy=false;renderProgress();event.target.value='';}
};
function exportSession(){
 if(!session.length)return;
 const lines=['# Kaizen GTO practice session','',`Exported: ${new Date().toISOString()}`,'Each decision identifies its coaching, history, simulation or solution source. Keep this export for your own records.','','date | profile | area | spot | your action | verdict | note',...session.map(r=>`${r.time} | ${r.profile} | ${labels[r.area]} | ${r.spotId}; ${r.hole}; ${r.board||'preflop'} | ${r.choice} | ${r.grade} | ${r.heuristic}; ${r.strategy?`solution: ${r.strategy.packId}/${r.strategy.nodeId}; ${r.strategy.coverage}; EV loss: ${r.strategy.lossBB??'unscored'}bb; action frequency: ${r.strategy.frequency??'unscored'}; `:''}${r.mode==='solved'?`solved model: ${r.solution.packId}/${r.solution.nodeId}; coverage: ${r.solution.coverage}; EV loss: ${r.solution.lossBB??'unscored'}bb; action frequency: ${r.solution.frequency??'unscored'}; `:r.mode==='simulation'?`simulation: v${r.simulationVersion}; policy: ${r.simulationPolicy}; seed: ${r.simulationSeed}; branch: ${r.branchIndex}; hand-session: ${r.handSessionId}; `:r.mode==='hand'?`hand-session: ${r.handSessionId}; original: ${r.originalAction}; replay: ${r.replayStatus}; `:''}decision-id: ${r.id}`)];
 const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/markdown'})),a=document.createElement('a');a.href=url;a.download='kaizen-gto-session-'+new Date().toISOString().slice(0,10)+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('actions').addEventListener('click',event=>{const b=event.target.closest('[data-action]');if(b)act(b.dataset.action);});
$('presets').addEventListener('click',event=>{const b=event.target.closest('[data-size]');if(b&&!b.disabled&&!answered)setAmount(b.dataset.size);});
$('bet-slider').oninput=e=>{if(!answered)setAmount(e.target.value);};
$('bet-amount').onchange=e=>{if(!answered&&e.target.value!==''&&Number.isFinite(e.target.valueAsNumber))setAmount(e.target.valueAsNumber);};
$('decrease').onclick=()=>stepStrategyAmount(-1);$('increase').onclick=()=>stepStrategyAmount(1);
$('history-toggle').onclick=()=>setHistoryExpanded($('history-full').hidden);
$('hand-pool').onchange=()=>{if($('hand-pool').value==='reviewed'){$('profile').value='online';$('focus').value='all';$('difficulty').value='all';$('strategy-timing').value='hand';}countPool();};
$('settings-toggle').onclick=()=>{const open=$('settings').hidden;$('settings').hidden=!open;$('settings-toggle').setAttribute('aria-expanded',String(open));$('play-panel').classList.toggle('settings-open',open);};
for(const focus of ['all','preflop','postflop','pressure'])$('guided-'+focus).onclick=()=>{if(transferBusy)return;$('focus').value=focus;begin();updateStats();};
$('next').onclick=()=>{if(answered&&!$('next').disabled)nextHand();};$('skip').onclick=()=>nextHand();$('apply').onclick=()=>begin();$('review-misses').onclick=()=>begin(true);$('retry-decision').onclick=()=>{if(answered&&current?.sourceType==='solver-practice'){next(current);resetHandView();}};$('practice-mode').onchange=()=>{if(transferBusy)return;if(isHandMode()){$('profile').value='all';$('focus').value='all';$('difficulty').value='all';}if(!isGuidedMode()&&['postflop','pressure'].includes($('focus').value))$('focus').value='all';if(['solved','strategy'].includes($('practice-mode').value)){$('profile').value='online';$('focus').value=$('practice-mode').value==='solved'?'river':'all';$('difficulty').value='1';}begin();updateStats();};
for(const [id,mode] of [['path-practice','strategy'],['path-hands','hand'],['path-coaching','drill'],['path-lab','solved']])$(id).onclick=()=>{
 if(transferBusy)return;
 $('explore-menu').open=false;
 if($('practice-mode').value===mode&&!(mode==='hand'&&!isReadyHandMode()))return;
 $('practice-mode').value=mode;$('practice-mode').onchange();
};
$('start-next-set').onclick=()=>startNextSet();$('set-targeted').onclick=()=>startNextSet(setNextFocus);
$('export').onclick=exportSession;$('retry-save').onclick=retryProgress;$('import-files').onchange=importFiles;
for(const id of ['profile','focus','difficulty'])$(id).onchange=countPool;
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
$('review-list').addEventListener('click',event=>{const sim=event.target.closest('[data-sim-record]');if(sim){const record=records.find(r=>r.id===sim.dataset.simRecord),hand=allReplayHands().find(h=>h.id===record?.handId);if(hand&&record.simulationVersion===PokerSim.VERSION&&record.simulationPolicy===PracticeOpponents.id)startSimulation(hand,record.branchIndex,record.simulationSeed);else $('backup-status').textContent='This branch needs its original hand and simulation version.';return;}const full=event.target.closest('[data-replay-hand]');if(full){const hand=allReplayHands().find(h=>h.id===full.dataset.replayHand);if(hand){missMode=false;dealReadyHand(hand.id);showView('train');}return;}const b=event.target.closest('[data-replay]');if(b){const spot=allSpots().find(s=>s.id===b.dataset.replay)||allReplayHands().flatMap(h=>h.spots).find(s=>s.id===b.dataset.replay);if(spot){missMode=false;next(spot);showView('train');}}});
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||$('train').hidden||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;const action={f:'fold',c:'passive',b:'aggressive','1':'fold','2':'passive','3':'aggressive'}[e.key.toLowerCase()];if(action){e.preventDefault();act(action);}if(e.key==='Enter'&&strategyContinuation){e.preventDefault();const advance=strategyContinuation;strategyContinuation=null;advance();}else if(e.key==='Enter'&&answered&&!$('next').disabled){e.preventDefault();nextHand();}});
document.addEventListener('visibilitychange',()=>{if(!current||answered)return;if(document.hidden)clockElapsed+=performance.now()-clockStart;else clockStart=performance.now();});
window.addEventListener('beforeunload',e=>{if(pending.length){e.preventDefault();e.returnValue='';}});
$('backup-restore-label').hidden=false;$('backup-restore').hidden=false;
$('backup-restore').onchange=async event=>{
 const file=event.target.files[0];if(!file||!progressReady||transferBusy)return;
 if(importBusy){$('backup-status').textContent='Finish the current hand import first.';return;}
 transferBusy=true;$('backup-export').disabled=true;
 $('backup-restore').disabled=true;$('backup-status').textContent='Restoring backup…';
 try{
  if(file.size>50000000)throw new Error('Backup exceeds the 50 MB restore limit.');
  while(saving)await new Promise(resolve=>setTimeout(resolve,50));
  if(pending.length){await savePending();if(pending.length)throw new Error('Save the current decisions before restoring.');}
  const data=JSON.parse(await file.text());await LocalPractice.restore(data);
  const saved=await api('progress');records=saved.records;imports=saved.imports;storedProgressLoaded=true;records.forEach(r=>savedDecisionIds.add(r.id));
  updateStats();countPool();
  $('backup-status').textContent=`Backup restored. ${records.length} decisions and ${imports.filter(i=>i.kind==='hand').length} hands available. Existing items were preserved.`;
 }catch(error){$('backup-status').textContent='Restore failed: '+error.message;}
 finally{transferBusy=false;$('backup-restore').disabled=false;$('backup-export').disabled=!storedProgressLoaded;event.target.value='';if(!current)next();}
};

boot();
