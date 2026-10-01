'use strict';
const strategyCatalogue=StrategyReview.create(STRATEGY_PACKS);
const guidedPracticeSpots=GuidedPractice.prepare(strategyCatalogue,PokerTable,StrategyReview,StrategyCoach);
let strategyContinuation=null;
function currentStrategySizes(){
 if(!current||!table)return [];
 const found=strategyCatalogue.match(current,table,currentStrategyContext());
 return found?found.node.actions.filter(a=>['bet','raise'].includes(a.type)).map(a=>a.amountBB).sort((a,b)=>a-b):[];
}
function renderStrategyControls(){
 const found=strategyCatalogue.match(current,table,currentStrategyContext());
 if(!found)return;
 $('game-tag').textContent=current.sourceType==='history'?'YOUR HAND · SOLVED RANGE MODEL':(current.board.length===5?'RIVER':current.board.length===4?'TURN':current.board.length===3?'FLOP':'PREFLOP')+' SPOT · RANGE MODEL';
 if(found.pack.provenance.review==='reviewed-reference')$('game-tag').textContent='PREFLOP · SOURCE REFERENCE';
 $('opponent-note').hidden=false;$('opponent-note').classList.add('model-note');$('opponent-label').textContent='Reference spot';
 $('opponent-read').textContent='Read the history, consider the ranges, then choose. Model details are available with your feedback.';
 if(found.node.unavailableActions?.includes('call')){$('passive-action').disabled=true;$('passive-action').innerHTML='Limp unavailable';$('opponent-read').textContent='This opening reference offers raise or fold. Limping is outside its tree.';}
 if(table.preflop){$('spot-heading').textContent=current.hero+(table.highest>1?' facing a raise':table.call?' opening range':' facing a limp');$('last-action').textContent=table.highest>1?'Facing a raise to '+fmt(table.highest)+'bb':table.call?'Unopened pot':'Small blind completed';$('ask').textContent=found.node.unavailableActions?.includes('call')?'Open or fold?':table.call?fmt(table.call)+'bb to call':'Check or raise?';}
 const sizes=currentStrategySizes();
 $('bet-controls').classList.toggle('single-size',isGuidedMode()&&sizes.length===1);
 $('aggressive-action').disabled=!sizes.length;$('bet-controls').hidden=!sizes.length;
 if(table.call&&table.call===table.remaining)$('passive-action').innerHTML='Call '+fmt(table.call)+'bb (all-in)<span class="key">C</span>';
 if(sizes.length){
  $('bet-label').textContent=table.highest?'Solution sizes · raise total':'Solution bet sizes';
  for(const id of ['bet-slider','bet-amount']){$(id).min=sizes[0];$(id).max=sizes.at(-1);}
  $('min-label').textContent=fmt(sizes[0])+'bb';$('max-label').textContent=(sizes.at(-1)===table.max?'All-in ':'')+fmt(sizes.at(-1))+'bb';
 }
 // All tree sizes are offered, including 0%-frequency alternatives. No answer is shown before a choice.
 $('presets').innerHTML=sizes.map(n=>`<button type="button" data-size="${n}">${fmt(n)}bb</button>`).join('');
}
function stepStrategyAmount(direction){
 if(answered)return;
 const sizes=currentStrategySizes(),i=sizes.indexOf(amount);
 setAmount(sizes.length?sizes[Math.max(0,Math.min(sizes.length-1,i+direction))]:amount+direction);
}
function currentStrategyContext(spot=current){
 return StrategyReview.context(spot,spot.sourceType==='simulation'&&simRun?simulationMetadata():null);
}
function evaluateCurrentStrategy(action){
 return strategyCatalogue.evaluate(current,table,currentStrategyContext(),action,amount);
}
function attachStrategy(record,result){
 if(!result)return;
 record.strategy=result;record.grade=result.grade;
 delete record.decisionState; // The verified result already preserves this state.
 record.preferred='Action mix from '+result.source.name;
 const teaching=StrategyCoach.explain(result);
 record.why=teaching?teaching.hand+' '+teaching.points.join(' '):result.explanation;record.heuristic=teaching?.takeaway||'Compare decision EV separately from how often an action is used.';
 if(result.context.kind==='hand')record.handId=result.context.handId;
}
function strategyActionLabel(a){
 if(a.type==='fold')return 'Fold';if(a.type==='check')return 'Check';
 if(a.type==='call')return 'Call '+fmt(a.amountBB)+'bb';
 return (a.type==='raise'?'Raise to ':'Bet ')+fmt(a.amountBB)+'bb';
}
function strategyFrequency(f){
 if(f>0&&f<.0001)return '<0.01%';
 if(f<1&&f>.9999)return '>99.99%';
 return fmt(f*100)+'%';
}
function strategyEV(value){return (Math.abs(value)<.0005?0:value).toFixed(3);}
function strategyCoaching(result){
 const explanation=StrategyCoach.explain(result);
 if(!explanation)return `<p>${esc(result.explanation)}</p>`;
 return `<section class="strategy-coaching"><h4>${esc(explanation.title)}</h4><p><strong>${esc(explanation.hand)}</strong>${explanation.draw?' '+esc(explanation.draw):''}</p><ul>${explanation.points.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><p class="heuristic">${esc(explanation.takeaway)}</p><p class="small muted">Coaching interpretation of this model.</p></section>`;
}
function strategyFeedback(result){
 const covered=result.coverage==='covered',chosen=result.chosen,impact=GuidedPractice.impact(result);
 const lead=result.actions.reduce((a,b)=>b.frequency>a.frequency?b:a),chosenRow=result.actions.find(a=>a.type===chosen.type&&a.amountBB===chosen.amountBB);
 const outsideMainMix=covered&&result.grade==='good'&&lead.frequency>.99&&chosenRow?.frequency<.01;
 const heading=!covered?(result.coverage==='solver-uncertainty'?'Solution needs a closer review':'Action outside this solution'):outsideMainMix?'Low EV loss · differs from the mix':result.grade==='good'?'Good choice · low EV loss':impact.label;
 const rows=[...result.actions].sort((a,b)=>b.frequency-a.frequency).map(a=>{
  const selected=a.type===chosen.type&&a.amountBB===chosen.amountBB;
  const label=a.type==='bet'?`Bet ${Math.round(a.amountBB/result.state.table.pot*100)}% pot · ${fmt(a.amountBB)}bb`:strategyActionLabel(a);
  return `<tr${selected?' class="solver-chosen"':''}><th scope="row">${esc(label)}${selected?' · you':''}</th><td><span class="strategy-frequency" title="${esc((a.frequency*100).toFixed(6))}% in the source" style="--frequency:${a.frequency*100}%"><span>${esc(strategyFrequency(a.frequency))}</span></span></td><td title="${esc(a.evBB)}bb in the source">${strategyEV(a.evBB)}bb</td></tr>`;
 }).join('');
 const teaching=StrategyCoach.explain(result);
 const theme=GuidedPractice.lesson({strategy:result,area:guidedPracticeSpots.find(s=>s.id===result.context.spotId)?.area});
 const takeaway=teaching?`<div class="decision-takeaway"><strong>${esc(theme)} · Takeaway</strong><p>${esc(teaching.takeaway)}</p></div>`:'';
 const state=result.state,reference=result.source.review==='reviewed-reference',position=state.table.preflop?(state.table.highest>1?'Facing a raise':state.table.call?'Unopened pot':'Facing a limp'):state.table.call?'Facing a bet':StrategyCoach.actsLast(state)?'Acting last':'Acting first';
 const context=`<div class="decision-context"><div><span>Your hand · ${esc(state.hero)}</span><div class="cards">${cards(state.hole)}</div></div>${state.board.length?`<div><span>Board at your decision</span><div class="cards">${cards(state.board)}</div></div>`:'<div><span>Preflop · 100bb reference</span></div>'}<p>${esc(position)} · ${fmt(state.table.pot)}bb pot before your action</p><details><summary>Action leading here</summary>${HandContext.rows(state.history).map(h=>`<p><strong>${esc(h.street)}:</strong> ${esc(h.text)}</p>`).join('')}</details></div>`;
 const bestEV=Math.max(...result.actions.map(a=>a.evBB)),similar=result.actions.filter(a=>bestEV-a.evBB<=result.evToleranceBB&&a.frequency>=.01);
 const alternatives=covered&&similar.length>1?`<p class="mix-explanation"><strong>${similar.map(a=>esc(strategyActionLabel(a))).join(' and ')} are ${similar.length===2?'both ':''}low-loss choices here.</strong> Their EVs are within ${fmt(result.evToleranceBB)}bb. Use the percentages to learn the mix over repeated situations; this one choice cannot test whether you follow it.</p>`:'';
 const detail=covered?`<p><strong>EV loss: ${result.lossBB.toFixed(3)}bb</strong> · ${fmt(result.potFraction*100)}% of the ${fmt(result.state.table.pot)}bb pot before your action.</p>`:result.coverage==='solver-uncertainty'?'<p>The export gives a mixed action a larger EV difference than its grading tolerance. This choice is saved without a score until the solution is reviewed.</p>':'<p>This exact action has no supplied EV. The available solution is shown for reference; your choice is saved without a grade.</p>';
 const mixNote=outsideMainMix?`<p class="mix-explanation">The model chooses <strong>${esc(strategyActionLabel(lead))}</strong> ${esc(strategyFrequency(lead.frequency))} of the time. Your action’s ${result.lossBB.toFixed(3)}bb loss is inside the ${fmt(result.evToleranceBB)}bb grading tolerance, so it receives credit for low EV loss. That does not mean it follows the displayed mix. This small gap does not establish a meaningful practical mistake.</p>`:'';
 const positiveEV=!reference&&covered&&result.grade==='review'&&result.evBB>0?`<p>Your action still has <strong>positive model EV: ${result.evBB.toFixed(3)}bb</strong>. EV loss means it earns less than the best listed alternative; it does not mean this action loses money from the current decision.</p>`:'';
 const scope=result.context.kind==='drill'?'<p class="small muted">This drill scores one decision. Earlier history sets up the spot; it is not a recommendation to take that line with every hand. Action EV includes later responses in the solution, even though this drill ends after your choice.</p>':'';
 const referenceNote=reference?'<p class="reference-note">PokerData reference grade · convergence and rake are not reported. Action EV includes chips already invested; EV loss compares choices from the same point.</p>':'';
 const practical=covered?`<p class="ev-meaning">${impact.key==='low'?'This choice is within the model’s '+fmt(result.evToleranceBB)+'bb grading tolerance. A tiny EV gap alone is not a useful mistake to fix.':impact.key==='small'?'This difference is below 0.5bb. Refine it after the larger EV misses; it is not a major error in this set.':impact.key==='costly'?'This choice gives up at least 2bb versus the best listed action. Make it a priority in your set review.':'This choice gives up at least 0.5bb. Compare the other actions and take one specific adjustment into your next set.'}</p>`:'';
 const convergence=reference?'Source EV granularity is 0.005bb after unit conversion. This export was checked for data consistency, not independently re-solved.':`Reported ${esc(result.convergence.metric)}: ${result.convergence.valueBB.toFixed(4)}bb. The global convergence value is not an error bound for this individual hand.`;
 return `${context}<h3 class="verdict-${impact.key}">${heading}</h3><p class="chosen-frequency">You chose <strong>${esc(strategyActionLabel(chosen))}</strong>${chosenRow?' · '+esc(strategyFrequency(chosenRow.frequency))+' in this model':''}.</p><div class="comparison-scroll"><table class="replay-comparison strategy-actions"><thead><tr><th>Action</th><th>Frequency</th><th>${reference?'Source EV':'Action EV'}</th></tr></thead><tbody>${rows}</tbody></table></div>${alternatives}${detail}${practical}${mixNote}${positiveEV}${takeaway}${referenceNote}<details class="decision-reasoning"><summary>Why this line? Read the reasoning</summary>${strategyCoaching(result)}${scope}</details><p class="small muted">Frequency means how often the model uses an action, not the probability it is correct. EV loss compares the value of this choice. Tiny non-zero frequencies may be numerical residue rather than useful mixing targets.</p><details><summary>Solution assumptions</summary><p>${esc(result.source.name)} · ${esc(result.source.engine)}</p><p>${esc(result.source.assumptions)}</p><p>Rake: ${esc(result.source.rake)}. Range: ${esc(result.source.rangeReference)}.</p><p>${convergence} Grading tolerance: ${fmt(result.evToleranceBB)}bb. Coaching priorities: 0.5bb to review first; 2bb for a costly decision. These labels do not change saved grades.</p><p class="small muted">${esc(result.source.reference)}</p></details>`;
}
function pauseForStrategy(record,continuation){
 if(!record.strategy||$('strategy-timing').value==='hand')return false;
 strategyContinuation=continuation;
 $('play-panel').classList.remove('decision-active');
 $('feedback').hidden=false;$('feedback').className='feedback '+record.grade;
 $('feedback').innerHTML=strategyFeedback(record.strategy)+'<button id="continue-decision" class="primary">Continue hand →</button>';
 $('next').disabled=true;$('skip').disabled=false;
 $('continue-decision').onclick=()=>{const nextStep=strategyContinuation;strategyContinuation=null;if(nextStep)nextStep();};
 resetHandView();return true;
}
function handStrategyCount(id){return records.filter(r=>r.handSessionId===id&&r.strategy?.coverage==='covered'&&strategyCatalogue.validRecord(r)).length;}
function handStrategyReview(id){
 const rows=records.filter(r=>r.handSessionId===id);
 if(!rows.length)return '';
 const covered=handStrategyCount(id);
 return `<section class="hand-strategy-review"><h3>Your decision breakdown</h3><p class="review-coverage"><strong>${covered} of ${rows.length} played decisions have model EV grades.</strong> Every choice is shown below. Missing solutions are excluded from the score; matching the original action is a separate comparison.</p>`+rows.map((r,i)=>{
  const verified=r.strategy&&strategyCatalogue.validRecord(r),state=verified?r.strategy.state:r.decisionState;
  const board=state?.board||(r.board?r.board.split(' '):[]),hole=state?.hole||(r.hole?r.hole.split(' '):[]),n=board.length,street=n===0?'Preflop':n===3?'Flop':n===4?'Turn':'River';
  const context=`<div class="review-cards"><span>Your hand</span><div class="cards">${cards(hole)}</div>${n?`<span>Board at this choice</span><div class="cards">${cards(board)}</div>`:''}</div>`+(state?`<p class="small">You · ${esc(state.hero)} · ${fmt(state.table.pot)}bb before your action</p><details><summary>Action before this choice</summary>${HandContext.rows(state.history).map(h=>`<p><strong>${esc(h.street)}:</strong> ${esc(h.text)}</p>`).join('')}</details>`:'');
  const reason=n===0?'Preflop frequencies and action EVs are not connected for this configuration.':r.sourceType==='simulation'?'This changed line uses practice opponents. It needs a solution for its actual reached ranges, board and bets.':'No reviewed solution matches this exact reached decision yet.';
  const feedback=verified?strategyFeedback(r.strategy):`<div class="coverage-gap"><strong>Solution needed · no GTO grade</strong><p>${reason}</p><p>Your choice is saved for review. Winning the hand or matching the original play does not establish its quality.</p></div>`;
  return `<details class="hand-decision" open><summary>${i+1}. ${street} · ${esc(r.choice)} · ${verified&&r.strategy.coverage==='covered'?fmt(r.strategy.lossBB)+'bb EV loss':'solution needed'}</summary>${context}${r.originalAction?`<p><strong>Originally:</strong> ${esc(r.originalAction)}</p>`:''}${feedback}</details>`;
 }).join('')+'</section>';
}
