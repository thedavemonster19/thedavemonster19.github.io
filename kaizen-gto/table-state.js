/* Explicit snapshots of the existing authored hands, in big blinds.
 * committed is the amount invested on earlier streets; street is this street.
 * No opponent hole cards or future action are invented.
 */
'use strict';
const TABLE_STATES = {
  L01: { committed:20, read:'BB calls large bets with weak pairs.' },
  L02: { committed:25, read:'BB has repeatedly called large river bets with one pair.' },
  L03: { committed:11, read:'BB calls with second pair and weak top pair, but seldom bluffs.' },
  L04: { committed:20, street:{BTN:25,BB:90}, lastRaise:65, read:'Passive regular. Every large river raise you have seen was two pair or better.' },
  L05: { committed:5, read:'BB and BTN both call too wide.' },
  L06: { committed:0, street:{UTG:1,HJ:1,SB:1/3,BB:1}, read:'Both limpers call raises with weaker aces and broadways.' },
  L07: { committed:15, read:'BB has repeatedly called large river bets with any pair.' },
  L08: { committed:7, read:'BB is a loose caller.' },
  O01: { committed:2.5 }, O02: { committed:2.5 }, O03: { committed:2.5 },
  O04: { committed:0, street:{SB:0.5,BB:1} },
  O05: { committed:0, street:{SB:0.5,BB:1} },
  O06: { committed:0, street:{SB:0.5,BB:1} },
  O07: { committed:7, street:{BB:7.25} },
  O08: { committed:2.5, street:{BB:5.5}, read:'Drill range: BB only bets AK and JT here. Both are value hands.' },
  O09: { committed:2.5 }, O10: { committed:6.5 },
  O11: { committed:6.5, street:{BB:13.5}, read:'Drill range: 6 equally likely value combos beat AQ; 6 bluff combos lose to AQ.' },
  O12: { committed:6.5, street:{BB:20.25}, read:'Drill range: 12 equally likely value combos beat AQ; 3 bluff combos lose to AQ.' }
};
const PokerTable = (() => {
  const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const positionOrder = live => live ? ['SB','BB','UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN'] : ['SB','BB','UTG','HJ','CO','BTN'];
  function state(spot) {
    if (spot.tableSnapshot) {
      const value={...spot.tableSnapshot,active:new Set(spot.tableSnapshot.active),seats:spot.tableSnapshot.seats.map(p=>({...p,street:round(p.street),remaining:round(p.remaining)}))};
      for(const key of ['highest','heroStreet','remaining','call','pot','min','max','committed'])value[key]=round(value[key]);
      return value;
    }
    const snapshot = TABLE_STATES[spot.id];
    if (!snapshot) throw new Error(`Missing table snapshot: ${spot.id}`);
    const preflop = !spot.board.length;
    const order = positionOrder(spot.profile === 'live');
    const active = new Set(snapshot.active || [spot.hero, ...spot.villain.split(' + ')]);
    if (spot.villain === 'Table') order.forEach(p => active.add(p));
    if (preflop && !snapshot.active) { active.add('SB'); active.add('BB'); }
    const street = snapshot.street || {};
    const highest = Math.max(preflop ? 1 : 0, ...Object.values(street));
    const heroStreet = street[spot.hero] || 0;
    const remaining = round(spot.stack - snapshot.committed - heroStreet);
    const call = round(Math.min(remaining, highest - heroStreet));
    const pot = spot.currentPot ?? round(spot.pot + spot.bet);
    const lastRaise = snapshot.lastRaise || Math.max(1, highest);
    const max = round(remaining + heroStreet);
    const min = round(Math.min(max, highest ? highest + lastRaise : 1));
    return { preflop, order, active, street, highest, heroStreet, remaining, call, pot, min, max, canRaise:max>highest,
      read: snapshot.read || '', committed:snapshot.committed, verb:highest ? 'Raise to' : 'Bet',
      seats:order.map(position => ({ position, active:active.has(position), hero:position===spot.hero,
        street:street[position] || 0,
        remaining:round(spot.stack - (active.has(position) ? snapshot.committed : 0) - (street[position] || 0)) })) };
  }
  function clampAmount(value, table) { return round(Math.max(table.min, Math.min(table.max, Number(value) || table.min))); }
  function presets(table, live) {
    const list = table.preflop ? (live ? [3,5,8,10] : [2,2.5,3,4]).map(n => ({label:`${n}bb`,amount:n}))
      : table.highest ? [
        {label:'2×',amount:table.highest*2}, {label:'3×',amount:table.highest*3},
        {label:'Pot',amount:table.highest+table.pot+table.call}]
      : [0.33,0.5,0.75,1].map(n => ({label:n===1?'Pot':`${Math.round(n*100)}%`,amount:table.pot*n}));
    return [...list.map(p => ({...p,amount:clampAmount(p.amount,table),disabled:p.amount<table.min || p.amount>table.max})),{label:'All-in',amount:table.max}];
  }
  // A nearby custom size can use an authored line's coaching judgment. Outside
  // this explicit 15% comparison window it is unscored, never snapped silently.
  function evaluate(spot, action, amount) {
    if(spot.sourceType==='solver-model')return typeof SolverGrades==='undefined'?{grade:'unscored'}:SolverGrades.evaluate(spot,action,amount);
    if (['history','simulation'].includes(spot.sourceType)) return {grade:'unscored',index:-1,comparison:'',exact:false};
    const table = state(spot);
    let index = -1, comparison = '', exact = true;
    if (action === 'fold') index = spot.options.findIndex(o => /^Fold/.test(o));
    if (action === 'passive') index = spot.options.findIndex(o => /^(Check|Call|Limp)/.test(o));
    if (action === 'aggressive') {
      const candidates = spot.options.map((label,i) => ({label,i,amount:/all-in/i.test(label)?table.max:Number(label.match(/[\d.]+/)?.[0])}))
        .filter(o => /^(Bet|Raise)/.test(o.label));
      const nearest = candidates.sort((a,b) => Math.abs(a.amount-amount)/a.amount - Math.abs(b.amount-amount)/b.amount)[0];
      if (nearest) {
        exact = Math.abs(nearest.amount-amount)<0.011;
        // An authored jam only teaches a jam, not every raise near the stack.
        const covered = /all-in/i.test(nearest.label) ? exact : Math.abs(nearest.amount-amount)/nearest.amount<=0.15;
        if (covered) { index=nearest.i; if(!exact) comparison=nearest.label; }
      }
    }
    const grade = index<0 ? 'unscored' : index===spot.best ? 'good' : spot.okay.includes(index) ? 'reasonable' : 'review';
    return {grade,index,comparison,exact};
  }
  return {state,clampAmount,presets,evaluate,round};
})();
if (typeof module !== 'undefined') module.exports=PokerTable;
