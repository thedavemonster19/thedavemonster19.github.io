// Authored coaching cases. Scores describe the lesson, not solver EV or frequencies.
const SPOTS=[];
function add(id,profile,area,level,hero,villain,hole,board,pot,bet,history,options,best,okay,why,heuristic,overlay=''){
 SPOTS.push({id,profile,area,level,hero,villain,hole:hole.split(' '),board:board?board.split(' '):[],pot,bet,history,options,best,okay,why,heuristic,overlay,stack:profile==='live'?200:100});
}
add('L01','live','value',1,'BTN','BB','As Kd','Kc 8h 3s 2d 7c',40,0,
[['Preflop','You raise to 5bb; BB calls. SB folds.'],['Flop','BB checks. You bet; BB calls.'],['Turn','BB checks. You bet; BB calls.'],['River','BB checks.']],
['Check','Bet 10bb','Bet 30bb'],2,[1],
'Against this specific calling-station read, top pair/top kicker can target worse Kx with a larger value size. A small bet leaves value behind when those hands will also call ¾ pot.',
'Choose the largest value size worse hands will still call.',
'A balanced strategy protects checks and uses different sizes across its range. This exploit shifts toward larger value bets because the opponent overcalls.');
add('L02','live','value',1,'CO','BB','Qs Qh','Qd 9c 4s 2h 7d',50,0,
[['Preflop','You raise to 5bb; BB calls.'],['Flop','BB checks, you bet, BB calls.'],['Turn','BB checks, you bet, BB calls.'],['River','BB checks.']],
['Check','Bet 12.5bb','Bet 40bb'],2,[],
'Top set has many worse hands to target and no flush or straight is possible on this board. The supplied overcalling read supports a large value bet.',
'With a very strong hand against an inelastic calling range, charge more.',
'The larger sizing exploits the stated read; it is not a claim that every opponent calls this size too widely.');
add('L03','live','value',2,'BTN','BB','Ah Jh','Jc 8d 4s 3c 2h',36,0,
[['Preflop','You raise to 5bb, BB calls.'],['Flop','BB check-calls your bet.'],['Turn','You both check.'],['River','BB checks.']],
['Check','Bet 9bb','Bet 24bb'],2,[1],
'The turn check keeps weaker pairs in the range. Given this explicit read, AJ can value-bet bigger than a token quarter-pot size. Be prepared to reassess if the passive opponent raises.',
'Thin value still wants a size tailored to the hands that will pay.',
'Against a stronger balanced opponent, checking some top-pair hands becomes more attractive.');
add('L04','live','river',2,'BTN','BB','As Kd','Kh 9c 4s 2d 8c',40,90,
[['Preflop','You raise; BB calls.'],['Flop','BB check-calls.'],['Turn','BB check-calls again.'],['River','Pot 40bb. BB checks, you bet 25bb, BB raises to 90bb total.']],
['Fold','Call 65bb','Raise all-in'],0,[],
'The read makes this raise strongly value-heavy. One pair beats little of that value range, and this opponent is not supplying enough bluffs to justify a bluff-catch just because the hand is near the top of your range.',
'Defend against the range your opponent actually has, not the bluffs you wish they had.',
'Balanced river raising ranges include bluffs. Folding more is the exploit against the explicitly underbluffing read.');
// River raise has a prior hero bet: override the generic facing-bet math.
SPOTS.at(-1).call=65;SPOTS.at(-1).currentPot=155;
add('L05','live','texture',1,'CO','BB + BTN','Ah Qd','9h 8h 7c',18,0,
[['Preflop','You raise; BTN and BB call.'],['Flop','BB checks. You act with BTN still to act.']],
['Check','Bet 6bb','Bet 14bb'],0,[],
'This connected multiway board gives the callers many pairs and draws. AQ without a heart has limited equity and poor fold equity into two sticky ranges.',
'Multiway pots demand stronger betting hands and fewer automatic c-bets.',
'Calling too wide makes a low-equity multiway bluff less appealing, not more.');
add('L06','live','preflop',1,'BTN','UTG + HJ','Ac Qc','',3.5,0,
[['Preflop','UTG limps 1bb, HJ limps 1bb, CO folds. You are BTN. Blinds remain.']],
['Fold','Limp 1bb','Raise to 8bb'],2,[],
'AQs is a strong value isolation hand in position. A larger raise charges the limpers and reduces the chance of creating a cheap multiway pot.',
'Isolate loose limpers with value and a size that charges their calls.',
'The exact size is table-dependent; 8bb is an illustrative live isolation size, not a solved optimum.');
add('L07','live','river',1,'BTN','BB','Qs Js','Ah Kd 7c 4h 2d',30,0,
[['Preflop','You raise; BB calls.'],['Flop','BB check-calls a small bet.'],['Turn','Both check.'],['River','BB checks.']],
['Check','Bet 15bb','Bet 30bb'],0,[],
'You have little showdown value, but that does not make every bluff profitable. The stated opponent does not fold enough pairs. Preserve chips by giving up.',
'Having no showdown value is a reason to consider a bluff—not a reason it must work.',
'A balanced opponent may fold enough to support some bluffs here. This station read changes the recommendation.');
add('L08','live','draws',2,'BTN','BB','Ah Kh','Qh Jh 3c',14,0,
[['Preflop','You raise, BB calls.'],['Flop','BB checks.']],
['Check','Bet 7bb','Bet 28bb'],1,[0],
'The nut flush draw plus a gutshot and overcards gives this hand substantial equity. A half-pot bet can build a pot for strong future hands while retaining some fold equity. Checking is also defensible; a 2x-pot bet is unnecessary for the lesson.',
'Strong draws can build pots; aggression is an option, not an obligation.',
'Against a caller, equity is especially important because immediate folds are less reliable.');
add('O01','online','draws',1,'BTN','BB','As Qs','Js Ts 3d',5.5,0,
[['Preflop','You open to 2.5bb, SB folds, BB calls.'],['Flop','BB checks.']],
['Check','Bet 3bb','Bet 11bb'],1,[0],
'The nut flush draw and gutshot give AQ strong equity and good barrel candidates. A moderate bet is a useful aggressive line. Checking can also belong in a mixed strategy; it is not inherently a mistake.',
'Use equity and future cards to choose your semi-bluffs.');
add('O02','online','texture',1,'BTN','BB','Ah Qc','Kd 7s 2c',5.5,0,
[['Preflop','You open to 2.5bb, SB folds, BB calls.'],['Flop','BB checks.']],
['Check','Bet 1.8bb','Bet 8bb'],1,[0],
'The preflop raiser has many strong Kx hands on this dry board. A small c-bet pressures unpaired hands at low cost. Checking AQ is also a reasonable range-protection choice.',
'On dry boards with a range advantage, small bets often accomplish enough.');
add('O03','online','texture',1,'BTN','BB','Ac Kd','9h 8h 7c',5.5,0,
[['Preflop','You open to 2.5bb, SB folds, BB calls.'],['Flop','BB checks.']],
['Check','Bet 1.8bb','Bet 5.5bb'],0,[],
'This board connects strongly with the BB calling range. AK without a heart has no immediate draw and benefits from controlling the pot rather than automatically betting.',
'Being the preflop raiser does not grant a c-bet on every texture.');
add('O04','online','preflop',1,'UTG','Table','As Ad','',1.5,0,
[['Preflop','6-max. You act first. Everyone starts with 100bb.']],
['Fold','Limp 1bb','Raise to 2.5bb'],2,[],
'AA is a clear open for value. Raising builds a pot and avoids offering the whole table a cheap entry.',
'Build your first-in strategy around raising your strong hands.');
add('O05','online','preflop',1,'UTG','Table','Kh 7d','',1.5,0,
[['Preflop','6-max. You act first. Everyone starts with 100bb.']],
['Fold','Limp 1bb','Raise to 2.5bb'],0,[],
'K7 offsuit is outside a standard tight early-position opening range. It is often dominated and has five players still to act behind.',
'Early-position opens need strength, not merely one high card.');
add('O06','online','preflop',1,'BTN','SB + BB','As Jd','',1.5,0,
[['Preflop','UTG, HJ and CO fold. You are on the button.']],
['Fold','Limp 1bb','Raise to 2.5bb'],2,[],
'AJ offsuit is comfortably strong enough to open on the button. Position and only two players remaining make this a straightforward raise.',
'Open wider when position and fewer remaining players work in your favor.');
add('O07','online','river',1,'BTN','BB','As Ad','Ah Kd 7c 4s 9h',24,12,
[['Preflop','You raise, BB calls.'],['Flop','BB checks, you bet, BB calls.'],['Turn','Both check.'],['River','BB leads 12bb into 24bb.']],
['Fold','Call 12bb','Raise to 36bb'],2,[1],
'Top set is the nuts on this unpaired board with no possible flush or straight. Raising targets worse value hands; calling is safe but may leave value behind. Folding the nuts is never right here.',
'Before bluff-catching, first ask whether your hand can raise for value.');
add('O08','online','river',2,'BTN','BB','7s 6s','Ah Kd Qc 4h 2d',20,20,
[['Preflop','You raise, BB calls.'],['Flop','Both check.'],['Turn','Both check.'],['River','BB bets 20bb into 20bb. For this drill, BB’s entire betting range is AK (value) and JT (value).']],
['Fold','Call 20bb','Raise to 70bb'],0,[],
'Against the explicitly supplied value-only range, seven-high has zero equity and no credible reason to call. MDF does not require defending each individual hand.',
'Pot odds tell you the required equity; the opponent range tells you whether you have it.');
add('O09','online','draws',2,'BTN','BB','Qh Jh','Th 9c 2h',5.5,0,
[['Preflop','You open to 2.5bb, SB folds, BB calls.'],['Flop','BB checks.']],
['Check','Bet 3.5bb','Bet 20bb'],1,[0],
'A flush draw plus an open-ended straight draw is a strong semi-bluff candidate. A moderate bet builds the pot without forcing a massive commitment. Checking remains a reasonable mixed alternative.',
'The best semi-bluffs combine equity when called with useful future barrels.');
add('O10','online','texture',2,'BTN','BB','As 5s','Kd 8h 4c 2s',13.5,0,
[['Preflop','You open to 2.5bb, BB calls, SB folds. Pot 5.5bb.'],['Flop','BB checks, you bet 4bb, BB calls.'],['Turn','BB checks.']],
['Check','Bet 9bb','Bet 27bb'],1,[0],
'The turn gives A5 a gutshot to the wheel. That extra equity makes it a better barrel candidate than total air. A moderate-to-large bet is a coaching line; checking can also be part of a balanced strategy.',
'Prefer barrels that improve on useful river cards.');
add('O11','online','river',2,'BTN','BB','As Qd','Ah 9c 7d 3s 2c',20,20,
[['Preflop','You raise, BB calls.'],['Flop','BB check-calls.'],['Turn','Both check.'],['River','BB bets 20bb into 20bb. Drill assumption: after card removal, BB has 6 equally likely value combos that beat AQ and 6 bluff combos AQ beats.']],
['Fold','Call 20bb','Raise to 60bb'],1,[],
'Under the stated combo model, you win 6 of 12 times: 50% equity. The call needs only 33.3%. Raising mostly folds out the bluffs and gets action from better hands.',
'Compare the bluff share you beat to the price of the call.');
add('O12','online','river',2,'BTN','BB','As Qd','Ah 9c 7d 3s 2c',20,30,
[['Preflop','You raise, BB calls.'],['Flop','BB check-calls.'],['Turn','Both check.'],['River','BB bets 30bb into 20bb. Drill assumption: after card removal, BB has 12 equally likely value combos that beat AQ and 3 bluff combos AQ beats.']],
['Fold','Call 30bb','Raise to 80bb'],0,[],
'Under this explicit model, AQ wins 3 of 15 times: 20%. The call requires 37.5%. A bigger bet plus too few bluffs makes folding the profitable choice.',
'A good-looking bluff-catcher still needs enough bluffs to call.');
// Complete the authored betting lines; live pots use 1/3bb for the small blind.
const byId=id=>SPOTS.find(s=>s.id===id);
function patch(id,values){Object.assign(byId(id),values)}
patch('L01',{pot:40.33,history:[['Preflop','You raise to 5bb. SB folds, BB calls. Pot 10.33bb.'],['Flop','BB checks. You bet 5bb; BB calls.'],['Turn','BB checks. You bet 10bb; BB calls.'],['River','BB checks. This opponent calls large bets with weak pairs and rarely raises without a very strong hand.']]});
patch('L02',{pot:50.33,history:[['Preflop','You raise to 5bb; BB calls. Everyone else folds. Pot 10.33bb.'],['Flop','BB checks, you bet 7.5bb, BB calls.'],['Turn','BB checks, you bet 12.5bb, BB calls.'],['River','BB checks. A known station has repeatedly paid large river bets with one pair.']]});
patch('L03',{pot:22.33,options:['Check','Bet 5.5bb','Bet 16bb'],history:[['Preflop','You raise to 5bb. SB folds, BB calls. Pot 10.33bb.'],['Flop','BB checks. You bet 6bb; BB calls.'],['Turn','You both check.'],['River','BB checks. This player calls with second pair and weak top pair, but seldom bluffs.']]});
patch('L04',{pot:40.33,currentPot:155.33,history:[['Preflop','You raise to 5bb; BB calls. SB folds. Pot 10.33bb.'],['Flop','BB checks, you bet 5bb, BB calls.'],['Turn','BB checks, you bet 10bb, BB calls.'],['River','Pot 40.33bb. BB checks, you bet 25bb, BB raises to 90bb total. BB is a passive regular; you have only seen large river raises with two pair or better.']]});
patch('L05',{pot:15.33,history:[['Preflop','You raise to 5bb; BTN and BB call. Everyone else folds.'],['Flop','BB checks. You act with BTN still to act. Both opponents tend to call too wide.']]});
patch('L06',{pot:3.33});
patch('L07',{pot:30.33,history:[['Preflop','You raise to 5bb; BB calls. SB folds. Pot 10.33bb.'],['Flop','BB checks, you bet 10bb, BB calls.'],['Turn','Both check.'],['River','BB checks. You have repeatedly seen this opponent call large river bets with any pair.']]});
patch('L08',{pot:14.33,history:[['Preflop','You raise to 7bb, SB folds, BB calls.'],['Flop','BB checks. Heads-up against a loose caller.']]});
patch('O07',{pot:14.5,bet:7.25,options:['Fold','Call 7.25bb','Raise to 21.75bb'],history:[['Preflop','You open to 2.5bb, SB folds, BB calls. Pot 5.5bb.'],['Flop','BB checks, you bet 4.5bb, BB calls.'],['Turn','Both check.'],['River','BB leads 7.25bb into 14.5bb.']]});
patch('O08',{pot:5.5,bet:5.5,options:['Fold','Call 5.5bb','Raise to 20bb'],history:[['Preflop','You open to 2.5bb, SB folds, BB calls.'],['Flop','Both check.'],['Turn','Both check.'],['River','BB bets 5.5bb into 5.5bb. For this drill, BB’s entire betting range is AK (value) and JT (value).']]});
for(const id of ['O11','O12']){const s=byId(id),b=id==='O11'?13.5:20.25;patch(id,{pot:13.5,bet:b,options:['Fold',`Call ${b}bb`,`Raise to ${b*3}bb`],history:[['Preflop','You open to 2.5bb, SB folds, BB calls. Pot 5.5bb.'],['Flop','BB checks, you bet 4bb, BB calls.'],['Turn','Both check.'],['River',`BB bets ${b}bb into 13.5bb. Drill assumption: after card removal, BB has ${id==='O11'?'6 equally likely value combos that beat AQ and 6 bluff combos AQ beats.':'12 equally likely value combos that beat AQ and 3 bluff combos AQ beats.'}`]]});}
if(typeof module!=='undefined')module.exports=SPOTS;
