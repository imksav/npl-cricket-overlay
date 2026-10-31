(() => {
 const params=new URLSearchParams(location.search);
 const matchId=params.get('matchId');
 if(!matchId) return; // Standalone/manual overlay continues to work as before.
 document.body.classList.add('api-mode');
 const notice=document.getElementById('apiOverlayNotice');
 const consoleBox=document.getElementById('manualScoringConsole');
 if(notice) notice.style.display='block';
 if(consoleBox) consoleBox.style.display='none';
 const headerControls=document.querySelector('header > div:last-child');
 if(headerControls) headerControls.style.display='none';
 const refreshMs=Math.max(60000,Math.min(3600000,Number(params.get('refresh')||900)*1000));
 const $=id=>document.getElementById(id);
 const set=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
 const short=name=>String(name||'TBD').split(/\s+/).map(x=>x[0]).join('').slice(0,3).toUpperCase();
 function inningsOvers(score){const o=String(score?.o ?? score?.overs ?? '0');return o.endsWith('ov')?`(${o})`:`(${o} ov)`;}
 function render(m,payload){
  const teams=Array.isArray(m.teams)?m.teams:[m.team1,m.team2].filter(Boolean);
  const score=Array.isArray(m.score)?m.score:[];
  const current=score.length?score[score.length-1]:null;
  const inningsName=String(current?.inning||'');
  let batting=teams.find(t=>inningsName.toLowerCase().startsWith(String(t).toLowerCase())) || teams[0] || 'Team A';
  let bowling=teams.find(t=>t!==batting) || teams[1] || 'Team B';
  const status=String(m.status||m.matchStatus||'Score feed available');
  const scoreText=current?`${current.r??current.runs??0}-${current.w??current.wickets??0}`:'—';
  const overs=current?inningsOvers(current):'(overs unavailable)';
  set('headerMatchTitle',m.name||`${batting} vs ${bowling}`);
  set('headerMatchType',String(m.matchType||'Cricket').toUpperCase());
  set('matchNumberLabel',m.matchNumber||m.match_number||'CRICKET MATCH');
  set('venueLabel',m.venue||'Venue not supplied by API');
  set('tossLabel',m.tossWinner?`${m.tossWinner} won toss ${m.tossChoice||''}`:'Toss information not supplied');
  set('inningsBadge',current?.inning||status);
  set('battingTeamName',batting);set('battingTeamShort',short(batting));
  set('bowlingTeamName',bowling);set('bowlingTeamShort',short(bowling));
  set('teamScore',scoreText);set('teamOvers',overs);
  set('matchStateHeader',/won|draw|tie|no result|abandon|complete/i.test(status)?'FINAL':'LIVE');
  set('targetEquationBox',status);
  set('bowlingTeamSummary',score.length>1?`${score.length} innings recorded`:'Live score feed');
  set('prevOverText','Not supplied by currentMatches');set('lastWicketText','Not supplied by currentMatches');
  set('currentOverNumLabel','—');set('currentOverRunsTotal','—');set('extrasTotalCount','—');
  const balls=$('currentOverBallsContainer');if(balls)balls.innerHTML='<span class="text-slate-400 text-xs">Ball-by-ball data is not included in this current-match response.</span>';
  set('liveCommentaryFeedBox',status);
  ['strikerName','nonStrikerName','bowlerName'].forEach(id=>set(id,'Player details not supplied'));
  ['strikerRuns','strikerBalls','striker4s','striker6s','strikerSR','nonStrikerRuns','nonStrikerBalls','nonStriker4s','nonStriker6s','nonStrikerSR','bowlerWickets','bowlerRunsConceded','bowlerOvers','bowlerDots','bowlerEcon'].forEach(id=>set(id,'—'));
  if(notice) notice.textContent=`CRICKETDATA FEED • ${new Date(payload.fetchedAt).toLocaleTimeString()} • ${status}`;
  document.title=`${m.name||'Live Cricket'} | Broadcast Overlay`;
 }
 async function update(){
  try{
   const r=await fetch('/api/matches',{cache:'no-store'});const p=await r.json();
   if(!r.ok||!p.ok)throw new Error(p.error||'API unavailable');
   const m=(p.matches||[]).find(x=>String(x.id??x.matchId??x.unique_id??x.match_id??'')===matchId);
   if(!m)throw new Error('Selected match is not present in the provider current-match feed. It may have finished or may not be covered by this API.');
   render(m,p);
  }catch(e){if(notice)notice.textContent=`API FEED ISSUE • ${e.message}`;set('matchStateHeader','FEED ISSUE');set('liveCommentaryFeedBox',e.message);}
 }
 update();setInterval(update,refreshMs);
})();
