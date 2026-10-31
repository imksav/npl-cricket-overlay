const $ = (id) => document.getElementById(id);
let matches = [];
let selectedId = localStorage.getItem('nplOverlayMatchId') || '';
let lastPayload = null;
const nplPattern = /nepal premier league|\bnpl\b|janakpur bolts|kathmandu gorkhas|chitwan rhinos|pokhara avengers|biratnagar kings|lumbini lions|sudurpaschim royals|karnali yaks/i;
function matchId(m) { return String(m.id ?? m.matchId ?? m.unique_id ?? m.match_id ?? ''); }
function teams(m) { return Array.isArray(m.teams) ? m.teams : [m.team1, m.team2].filter(Boolean); }
function matchText(m) { return [m.name, m.series, m.seriesName, m.matchType, ...teams(m)].filter(Boolean).join(' '); }
function isNpl(m) { return nplPattern.test(matchText(m)); }
function statusKind(m) { const s = `${m.status || ''} ${m.matchStatus || ''}`.toLowerCase(); if (/live|in progress|innings|stumps|break/.test(s)) return 'live'; if (/won|draw|tie|abandon|no result|complete|finished/.test(s)) return 'finished'; return 'upcoming'; }
function safe(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function scoreLine(m) { const arr = Array.isArray(m.score) ? m.score : []; if (!arr.length) return m.status || 'Score not supplied'; return arr.map(s => `${s.inning || s.team || 'Innings'}: ${s.r ?? s.runs ?? 0}/${s.w ?? s.wickets ?? 0} (${s.o ?? s.overs ?? '?'} ov)`).join(' · '); }
function render() {
 const q = $('search').value.trim().toLowerCase(), f = $('filter').value;
 const shown = matches.filter(m => (!q || matchText(m).toLowerCase().includes(q) || String(m.status||'').toLowerCase().includes(q)) && (f==='all' || (f==='npl' ? isNpl(m) : statusKind(m)===f)));
 $('matches').innerHTML = shown.length ? shown.map(m => { const id=matchId(m), kind=statusKind(m), selected=id===selectedId; return `<button class="match w-full text-left ${selected?'selected':''}" data-id="${safe(id)}"><div class="flex justify-between gap-2 items-start"><strong class="text-white text-sm">${safe(m.name || teams(m).join(' vs ') || 'Cricket match')}</strong><span class="tag">${kind.toUpperCase()}</span></div><div class="text-amber-300 text-sm font-semibold mt-2">${safe(scoreLine(m))}</div><div class="muted text-xs mt-2">${safe(m.venue || m.date || m.dateTimeGMT || '')}</div></button>`; }).join('') : '<div class="muted text-sm p-4">No matching fixtures were returned by the API. Try “All returned matches” or check the provider coverage.</div>';
 document.querySelectorAll('[data-id]').forEach(el=>el.addEventListener('click',()=>selectMatch(el.dataset.id)));
 updateSelected();
}
function selectMatch(id) { selectedId=id; localStorage.setItem('nplOverlayMatchId',id); render(); }
function updateSelected() {
 const m=matches.find(x=>matchId(x)===selectedId);
 $('startBtn').disabled=!m;
 $('copyBtn').disabled=!m;
 if(!m){$('selectedSummary').textContent='Select a match from the list.';$('overlayUrl').value='';$('openBtn').href='#';$('openBtn').classList.add('opacity-40','pointer-events-none');return;}
 $('selectedSummary').innerHTML=`<div class="text-white font-bold">${safe(m.name || teams(m).join(' vs '))}</div><div class="text-amber-300 mt-2">${safe(scoreLine(m))}</div><div class="muted text-xs mt-2">${safe(m.status || 'Status unavailable')} · ${safe(m.venue || 'Venue not supplied')}</div>`;
 const interval=Number($('interval').value||900);
 const url=`${location.origin}/overlay.html?matchId=${encodeURIComponent(selectedId)}&refresh=${interval}`;
 $('overlayUrl').value=url;$('openBtn').href=url;$('openBtn').classList.remove('opacity-40','pointer-events-none');
}
async function loadMatches() {
 $('providerStatus').textContent='FETCHING';$('connectionText').textContent='Requesting current matches from CricketData.org…';
 try {
  const res=await fetch('/api/matches',{cache:'no-store'}); const payload=await res.json();
  if(!res.ok || !payload.ok) throw new Error(payload.error || 'API request failed');
  lastPayload=payload; matches=payload.matches || [];
  $('providerStatus').textContent='CONNECTED';$('providerStatus').style.background='#064e3b';$('providerStatus').style.color='#a7f3d0';
  $('connectionText').textContent=`Connected. ${payload.count} current matches returned. Last checked ${new Date(payload.fetchedAt).toLocaleTimeString()}.`;
  $('quota').textContent=payload.hitsUsed!==null ? `API usage reported: ${payload.hitsUsed} hits used of ${payload.hitsLimit ?? 'unknown'} daily.` : `Free plan: up to 100 hits/day. Current matches endpoint only.`;
  if(selectedId && !matches.some(m=>matchId(m)===selectedId)) selectedId='';
  if(!selectedId && matches.length) { const npl=matches.find(isNpl); if(npl) selectedId=matchId(npl); }
  render();
 } catch(e) {
  $('providerStatus').textContent='NOT CONNECTED';$('connectionText').textContent=e.message;
  $('matches').innerHTML=`<div class="text-rose-300 text-sm p-4">${safe(e.message)}<p class="muted mt-2">Add CRICKET_API_KEY to Vercel Environment Variables, then redeploy. No key is needed in this browser.</p></div>`;
  $('quota').textContent='';
 }
}
$('refreshBtn').addEventListener('click',loadMatches);
$('search').addEventListener('input',render);$('filter').addEventListener('change',render);$('interval').addEventListener('change',updateSelected);
$('startBtn').addEventListener('click',()=>{if(selectedId)window.open($('overlayUrl').value,'_blank','noopener');});
$('copyBtn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('overlayUrl').value);$('copyBtn').textContent='Copied ✓';setTimeout(()=>$('copyBtn').textContent='Copy URL',1600);}catch{$('overlayUrl').select();document.execCommand('copy');}});
loadMatches();
