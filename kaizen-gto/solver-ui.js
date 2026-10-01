'use strict';
function solverFeedback(result){
 const covered=result.coverage==='solved-model';
 const heading=!covered?'Size not solved':result.lossBB>1e-8?'Review this decision':result.frequency>1e-8?'Valid mixed-strategy choice':'EV-equivalent in this model';
 const loss=covered?`<p><strong>EV loss: ${fmt(result.lossBB)}bb</strong> · ${fmt(result.potFraction*100)}% of the pot before your action.</p>`:'<p>This exact size or state is outside the solution. It is saved without an EV grade; we do not round it to a nearby solved size.</p>';
 const rows=result.actions.map(a=>`<tr${a.code===result.action&&(a.code!=='aggressive'||a.amount===result.amount)?' class="solver-chosen"':''}><th scope="row">${esc(a.label)}</th><td>${fmt(a.frequency*100)}%</td><td>${fmt(a.evBB)}bb</td></tr>`).join('');
 return `<h3>${heading}</h3>${loss}<div class="comparison-scroll"><table class="replay-comparison"><thead><tr><th>Action</th><th>GTO mix in this model</th><th>Action EV</th></tr></thead><tbody>${rows}</tbody></table></div><p>A 50% action can be fully correct. Frequency is a target across repeated decisions, not a probability that this choice is correct.</p><p class="small muted">Solved heads-up river model · declared ranges · check/all-in tree · zero rake. Other sizes and your imported hands are not covered.</p>`;
}
function actSolved(action,button){
 const result=SolverGrades.evaluate(current,action,amount);
 const choice=action==='fold'?'Fold':action==='passive'?(table.call?'Call '+fmt(table.call)+'bb':'Check'):table.verb+' '+fmt(amount)+'bb';
 const record={id:decisionId(),spotId:current.id,profile:current.profile,area:current.area,hole:current.hole.join(' '),board:current.board.join(' '),choice,
  preferred:'Verified action mix in a declared river model',grade:result.grade,time:new Date().toISOString(),seconds:Math.round(decisionSeconds()*10)/10,
  sourceType:'solver-model',mode:'solved',why:current.why,heuristic:current.heuristic,solution:result};
 answered=true;records.push(record);session.push(record);
 document.querySelectorAll('[data-action], [data-size], #bet-slider, #bet-amount, #decrease, #increase').forEach(b=>b.disabled=true);button.classList.add('selected');
 const paid=action==='fold'?0:action==='passive'?table.call:PokerTable.round(amount-table.heroStreet);
 renderSeats(action,paid);$('pot').textContent=fmt(table.pot+paid)+' bb';$('pot-cash').textContent='≈ '+cash(table.pot+paid);
 $('turn-label').textContent='DECISION REVIEW';$('ask').textContent=choice;
 $('feedback').className='feedback '+result.grade;$('feedback').innerHTML=solverFeedback(result);$('feedback').hidden=false;
 $('play-panel').classList.remove('decision-active');$('next').disabled=false;$('skip').disabled=true;
 updateStats();pending.push({route:'decisions',data:record});savePending();resetHandView();
}
function renderSolverProgress(){
 const s=SolverGrades.summary(records),offTree=records.filter(r=>SolverGrades.validRecord(r)&&r.solution.coverage!=='solved-model').length;
 const mix=s.nodes.filter(n=>n.count).map(n=>`<details><summary>${esc(n.label)} · ${n.count} choices</summary><table class="replay-comparison"><thead><tr><th>Action</th><th>Target</th><th>Your mix</th></tr></thead><tbody>${n.actions.map(a=>`<tr><th>${esc(a.label)}</th><td>${fmt(a.target*100)}%</td><td>${fmt(a.observed*100)}%</td></tr>`).join('')}</tbody></table><p class="small muted">${n.count<20?'Small sample: these percentages are descriptive, not a mixing grade.':'Compare patterns over repeated sessions; no mixing-error grade or confidence claim is assigned.'}</p></details>`).join('');
 $('gto-progress').innerHTML=`<section class="source-item"><h2>GTO lab · solved river model</h2><p>${s.count} evaluated decisions · ${fmt(s.lossBB)}bb total EV loss${s.count?' · '+fmt(s.lossBB/s.count)+'bb per evaluated decision':''}.</p><p>${offTree} off-tree choices remain unscored. These results are separate from coaching accuracy and gradual levels.</p>${mix}<p class="small muted">Coverage: three declared model decisions. Personal hand replays and heuristic simulations have no GTO grade yet.</p></section>`;
}
