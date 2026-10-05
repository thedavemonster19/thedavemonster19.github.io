'use strict';
// Hand reviews page: a bundled example plus review packs imported from the hand-replay skill, kept in this browser.
(() => {
 const KEY='kaizen-review-packs';
 const DEMO={version:1,title:'Example — AK vs a river lead',hands:[{id:'EXAMPLE-1',title:'AK facing a big river lead',date:'Example hand',stakes:'$0.10/$0.25',bb:25,net:-1040,
  seats:[{n:'Player 1',p:'UTG',st:2500},{n:'Player 2',p:'HJ',st:2500},{n:'Player 3',p:'CO',st:2500},{n:'Hero',p:'BTN',st:2500,hero:true,c:['Ah','Kc']},{n:'Player 5',p:'SB',st:2500},{n:'Player 6',p:'BB',st:2500,c:['7h','6h']}],
  ev:[['post',4,10],['post',5,25],['street','Preflop'],['fold',0],['fold',1],['fold',2],['raise',3,60],['fold',4],['call',5],
   ['street','Flop',['As','7d','2c']],['check',5],
   ['pause',{k:'n',t:'Flop: top pair, top kicker',did:'Bet $0.80',better:'A small bet is fine',why:'You have the best hand most of the time. A small bet gets called by worse aces, sevens and draws.'}],
   ['bet',3,80],['call',5],['street','Turn',['Jh']],['check',5],['bet',3,200],['call',5],['street','River',['7s']],['bet',5,700],
   ['pause',{k:'m',t:'River: a passive caller leads big on the pairing card',did:'Call $7.00',better:'Fold',why:'The big blind called twice, then led for more than the pot when the seven paired. At low stakes that is trips or better far more often than a bluff. Ask which worse hand bets this big; if you cannot name one, fold.',odds:true}],
   ['call',3],['show',5],['result','Player 6 wins with three sevens. Example loss $10.40 (41.6bb).']]}]};
 const $=id=>document.getElementById(id);
 const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]');}catch{return [];}};
 const write=list=>{try{localStorage.setItem(KEY,JSON.stringify(list));return true;}catch{return false;}};
 let saved=read(),view=null;
 const status=(msg,err)=>{$('rv-status').textContent=msg;$('rv-status').className=err?'err':'';};
 function options(selected){
  const all=[{id:'demo',title:DEMO.title}].concat(saved.map(s=>({id:s.id,title:s.title})));
  $('rv-pack').innerHTML='';
  for(const o of all){const el=document.createElement('option');el.value=o.id;el.textContent=o.title;$('rv-pack').appendChild(el);}
  $('rv-pack').value=selected||all[all.length-1].id;show();
 }
 function show(){
  const id=$('rv-pack').value,pack=id==='demo'?DEMO:saved.find(s=>s.id===id)?.pack;
  $('rv-remove').hidden=id==='demo';
  if(view)view.destroy();
  try{view=ReviewReplay.mount($('rv-app'),pack);}catch(e){status(e.message,true);}
 }
 $('rv-pack').onchange=show;
 $('rv-file').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try{
   const pack=ReviewReplay.validate(JSON.parse(await file.text()));
   const id='pack-'+Date.now(),title=String(pack.title||file.name).slice(0,80);
   saved=saved.filter(s=>s.title!==title).concat({id,title,added:new Date().toISOString(),pack});
   const ok=write(saved);options(id);
   status(ok?`Imported ${pack.hands.length} hand${pack.hands.length>1?'s':''}.`:'Imported for this visit only: this browser is not saving site data.',!ok);
  }catch(err){status(err instanceof SyntaxError?'That file is not valid JSON. Choose a review pack exported by the hand-replay skill.':err.message,true);}
 };
 $('rv-remove').onclick=()=>{const id=$('rv-pack').value;saved=saved.filter(s=>s.id!==id);write(saved);options('demo');status('Review removed from this browser.');};
 options(saved.length?saved[saved.length-1].id:'demo');
})();
