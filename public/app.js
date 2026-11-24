/* SovSpreadle: the daily bond session, the interface. Needs core.js loaded first; loads data.json, episodes.json,
   notes.json and (when present) puzzles.json, the frozen daily schedule. */
{
'use strict';
const $ = id => document.getElementById(id);

/* ---------- sound (synthesized, no files) ---------- */
const prefs = Object.assign({snd:true, mus:true}, store.get("spreadle-prefs") || {});
let actx = null, master = null;
function ac(){
  if(!actx){const A = window.AudioContext || window.webkitAudioContext; if(!A) return null;
    try{actx = new A(); master = actx.createGain(); master.gain.value = .9; master.connect(actx.destination)}catch(e){return null}}
  if(actx.state === "suspended") actx.resume();
  return actx;
}
function env(g, t, a, peak, d){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+d)}
function tone(f, t, peak, d, type="sine", dest){const c=actx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);env(g,t,.004,peak,d);o.connect(g);g.connect(dest||master);o.start(t);o.stop(t+d+.05);return o}
function noise(t, d, peak, filt, freq, dest){const c=actx,b=c.createBuffer(1,Math.ceil(c.sampleRate*d),c.sampleRate),x=b.getChannelData(0);for(let i=0;i<x.length;i++)x[i]=Math.random()*2-1;
  const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=b;f.type=filt;f.frequency.value=freq;env(g,t,.002,peak,d);s.connect(f);f.connect(g);g.connect(dest||master);s.start(t)}
const SFX = {
  bell(){ // opening/closing bell: a clapper striking a brass bell
    const c=ac(); if(!c||!prefs.snd) return; const t0=c.currentTime+.02;
    for(let k=0;k<7;k++){const t=t0+k*.075, v=.16*(1-k*.06);
      [[1,1],[2.01,.45],[2.76,.32],[4.07,.18],[5.4,.1]].forEach(([m,a])=>tone(740*m,t,v*a,1.6-k*.05));
      noise(t,.02,.06,"highpass",3000)}
  },
  stamp(){const c=ac(); if(!c||!prefs.snd) return; const t=c.currentTime+.01;
    noise(t,.12,.5,"lowpass",700); const o=tone(110,t,.5,.22,"sine"); o.frequency.exponentialRampToValueAtTime(48,t+.2)},
  kaching(){const c=ac(); if(!c||!prefs.snd) return; const t=c.currentTime+.01;
    noise(t,.04,.25,"bandpass",2400); noise(t+.05,.03,.2,"bandpass",3200);
    [2637,3136,3951].forEach((f,i)=>{tone(f,t+.1+i*.03,.12,.7); tone(f*2.01,t+.1+i*.03,.03,.4)})},
  growl(){const c=ac(); if(!c||!prefs.snd) return; const t=c.currentTime+.01, d=.75;
    const f=c.createBiquadFilter(); f.type="lowpass"; f.frequency.value=420; const g=c.createGain(); env(g,t,.06,.35,d); f.connect(g); g.connect(master);
    const lfo=c.createOscillator(), lg=c.createGain(); lfo.frequency.value=19; lg.gain.value=.25; lfo.connect(lg); lg.connect(g.gain); lfo.start(t); lfo.stop(t+d+.1);
    [78,83.5].forEach(fr=>{const o=c.createOscillator(); o.type="sawtooth"; o.frequency.setValueAtTime(fr,t); o.frequency.linearRampToValueAtTime(fr*.82,t+d); o.connect(f); o.start(t); o.stop(t+d+.1)});
    noise(t,d*.8,.08,"lowpass",900)},
  bonk(){const c=ac(); if(!c||!prefs.snd) return; const t=c.currentTime+.01; const o=tone(220,t,.18,.18,"triangle"); o.frequency.exponentialRampToValueAtTime(120,t+.15)},
  ding(){const c=ac(); if(!c||!prefs.snd) return; const t=c.currentTime+.01; tone(1568,t,.14,.5); tone(2093,t+.07,.1,.6)},
  click(){const c=ac(); if(!c||!prefs.snd) return; noise(c.currentTime+.005,.015,.08,"highpass",2500)}
};
/* ragtime loop: oom-pah left hand, syncopated right hand; C | C | F | F | C | G7 | C | G7 */
const SONG = (()=>{const B={C:[48,43,[60,64,67]],F:[41,48,[57,60,65]],G:[43,50,[59,62,65]]};
  const prog=["C","C","F","F","C","G","C","G"];
  const mel=[[[0,76],[3,79],[6,84]],[[0,83],[2,84],[3,88],[6,86]],[[0,84],[3,81],[6,77]],[[0,81],[2,79],[3,77],[6,74]],[[0,76],[3,79],[6,88]],[[0,86],[2,83],[3,79],[6,77]],[[0,76],[3,72],[6,79]],[[0,77],[2,76],[3,74],[6,71]]];
  return {B,prog,mel}})();
let musTimer = null, musNext = 0, musStep = 0, musBus = null;
const mtof = m => 440*Math.pow(2,(m-69)/12);
function pianoNote(m, t, v, d){const c=actx; const g=c.createGain(); env(g,t,.006,v,d); const f=c.createBiquadFilter(); f.type="lowpass"; f.frequency.value=2600; g.connect(f); f.connect(musBus);
  const o1=c.createOscillator(); o1.type="triangle"; o1.frequency.value=mtof(m); const o2=c.createOscillator(); o2.type="sine"; o2.frequency.value=mtof(m)*2; const g2=c.createGain(); g2.gain.value=.35;
  o1.connect(g); o2.connect(g2); g2.connect(g); o1.start(t); o2.start(t); o1.stop(t+d+.05); o2.stop(t+d+.05)}
function musicStart(){const c=ac(); if(!c) return; if(!musBus){musBus=c.createGain(); musBus.gain.value=.5; musBus.connect(master)}
  musNext=c.currentTime+.1; musStep=0; clearInterval(musTimer);
  musTimer=setInterval(()=>{const st=.15; while(musNext < actx.currentTime+.35){
    const bar=Math.floor(musStep/8)%8, s=musStep%8, ch=SONG.B[SONG.prog[bar]];
    if(s===0) pianoNote(ch[0],musNext,.16,.45); if(s===4) pianoNote(ch[1],musNext,.14,.45);
    if(s===2||s===6) ch[2].forEach(n=>pianoNote(n,musNext,.06,.25));
    SONG.mel[bar].forEach(([p,n])=>{if(p===s) pianoNote(n,musNext,.11,.4)});
    musNext+=st; musStep++}},90)}
function musicStop(){clearInterval(musTimer); musTimer=null}
/* end-of-session finale: a ragtime fanfare for the bull, a roar and a sad trombone for the bear */
function finaleSound(bull){const c=ac(); if(!c||!prefs.snd) return;
  if(!musBus){musBus=c.createGain(); musBus.gain.value=.5; musBus.connect(master)}
  const t=c.currentTime+.05;
  if(musTimer){musBus.gain.setTargetAtTime(.12,c.currentTime,.05); musBus.gain.setTargetAtTime(.5,t+3.2,.3)}
  if(bull){ // pickup run, then a held C major chord over an oom-pah bass
    [[0,67],[.11,72],[.22,76],[.33,79]].forEach(([d,n])=>pianoNote(n,t+d,.2,.22));
    [[.48,77],[.6,76],[.72,74]].forEach(([d,n])=>pianoNote(n,t+d,.16,.16));
    [84,88,91].forEach(n=>pianoNote(n,t+.9,.14,1.6)); [48,60].forEach(n=>pianoNote(n,t+.9,.2,1.4));
    pianoNote(43,t+.6,.16,.3); setTimeout(SFX.kaching, 1000);
  } else { // the roar first, then four drooping trombone notes
    SFX.growl();
    const f=c.createBiquadFilter(); f.type="lowpass"; f.frequency.value=900; f.connect(master);
    [[.9,58],[1.35,57],[1.8,56],[2.25,55]].forEach(([d,n],i)=>{const tt=t+d, last=i===3, dur=last?1.1:.38;
      const o=c.createOscillator(), g=c.createGain(); o.type="sawtooth"; o.frequency.setValueAtTime(mtof(n),tt);
      if(last){ const lfo=c.createOscillator(), lg=c.createGain(); lfo.frequency.value=5.5; lg.gain.value=4; lfo.connect(lg); lg.connect(o.frequency); lfo.start(tt+.15); lfo.stop(tt+dur);
        o.frequency.linearRampToValueAtTime(mtof(n)*.9,tt+dur) }
      g.gain.setValueAtTime(.0001,tt); g.gain.exponentialRampToValueAtTime(.16,tt+.05); g.gain.setValueAtTime(.16,tt+dur-.12); g.gain.exponentialRampToValueAtTime(.0001,tt+dur);
      o.connect(g); g.connect(f); o.start(tt); o.stop(tt+dur+.05)});
  }}
function playFinale(){ const m = $("endMascot"), bull = rungOf(sess.score) >= 5, w = m.parentNode;
  w.classList.remove("rear","roar"); void w.getBoundingClientRect(); w.classList.add(bull ? "rear" : "roar"); finaleSound(bull) }

// notes cover a country and a period; one shows when the window covers enough of that period
// a short note with a date-free hint (h) can tell the story of a peak or low in a guess-the-year round
function storyNote(r){ if(r.t !== "year" || r.ep != null) return -1;
  return NOTES.findIndex(n=>n.c === r.c && n.h && ix(n.a) <= r.pk && r.pk <= ix(n.b) && ix(n.b) - ix(n.a) <= 12) }
function noteFor(c, s){ let best = -1, bl = 1e9; const seen = store.get("spreadle-notes") || {}, now = Date.now();
  NOTES.forEach((n, i)=>{ if(n.c !== c) return; const a = ix(n.a), b = ix(n.b), len = b-a+1, ov = Math.min(b, s+W-1) - Math.max(a, s) + 1;
    if(a < s || a > s+W-1 || ov < Math.min(24, len) || (seen[i] && now-seen[i] < 30*864e5)) return;
    if(len < bl){ bl = len; best = i } });
  if(best >= 0){ seen[best] = now; store.set("spreadle-notes", seen) }
  return best }
/* ---------- session state ---------- */
let dayN, dayLabel, plan, sess, mode = "daily", viewQ = 0, revealAnim = false, viewingDone = false, atHome = true;
function freshSession(rounds, n){ return {n, sig: hash(JSON.stringify(rounds)), cur:0, score:0, done:false, started:false, rs: rounds.map(()=>({g:[], h:[], seq:[], done:false, pts:0}))} }
// storage keys keep their original "spreadle-" names so saved progress and streaks survive the rename
function save(){ if(mode === "daily") store.set("spreadle-session4", sess) }
function loadDaily(){
  mode = "daily"; plan = dailyPlan(dayN);
  const saved = store.get("spreadle-session4"), sig = hash(JSON.stringify(plan));
  sess = saved && saved.n === dayN && saved.sig === sig ? saved : freshSession(plan, dayN);
}
// unlimited avoids the daily bonds from a week back to a week ahead, and your own recent unlimited bonds
function newUnlimited(){ mode = "unlimited";
  const today = Math.max(1, dayN); dailyPlan(today + 7); const ent = [];
  for(let d=Math.max(1, today-7); d<=today+7; d++) for(const h of answersOf(PLANS[d], d)) ent.push({...h, d: d===today ? 1e9 : 0, epd: Math.abs(d-today) <= 7});
  const mine = store.get("spreadle-unlim") || []; mine.forEach((h,i)=>ent.push({c:h.c, s:h.s, d: i >= mine.length-5 ? 1e9 : 0, ep:h.ep, epd: h.ep != null && i >= mine.length-15}));
  plan = buildPlan("unlimited-"+Date.now()+Math.random(), null, ctxOf(ent, 1e9));
  store.set("spreadle-unlim", [...mine, ...plan.filter(x=>x.c).map(x=>({c:x.c, s:x.s, ep:x.ep}))].slice(-40));
  sess = freshSession(plan, null); sess.started = true; viewQ = 0 }

/* ---------- comparisons and facts ---------- */
function hasData(rd, k){ if(k === rd.c) return true; if(rd.t === "spread" && k === "DE") return false;
  const a = seriesFor(rd, rd.c), b = seriesFor(rd, k); let n = 0; for(let i=rd.s;i<rd.s+W;i++) if(a[i]!=null && b[i]!=null) n++; return n >= 24 }
function compare(rd, g){
  if(g === rd.c) return {tier:0};
  const a = seriesFor(rd, rd.c), b = seriesFor(rd, g), x = [], y = [];
  let est = 0;
  for(let i=rd.s;i<rd.s+W;i++) if(a[i]!=null && b[i]!=null){x.push(a[i]); y.push(b[i]); if(estFor(rd, g, i)) est++}
  if(x.length < 24) return {tier:4};
  const mx = x.reduce((p,c)=>p+c)/x.length, my = y.reduce((p,c)=>p+c)/y.length; let sxy=0, sxx=0, syy=0;
  x.forEach((v,i)=>{sxy+=(v-mx)*(y[i]-my); sxx+=(v-mx)**2; syy+=(y[i]-my)**2});
  const corr = sxx && syy ? sxy/Math.sqrt(sxx*syy) : 0, gap = mx-my, ag = Math.abs(gap);
  return {gap, corr, est: est/x.length > .5, tier: ag<.5 && corr>.8 ? 1 : ag<1.5 ? 2 : 3};
}
const twinCache = {};
function twinOf(rd){
  const key = rd.t + rd.c + rd.s; if(key in twinCache) return twinCache[key];
  const a = seriesFor(rd, rd.c); let best = null, bc = -2;
  for(const k of keys){ if(k === rd.c || (rd.t === "spread" && k === "DE")) continue;
    const b = seriesFor(rd, k), x = [], y = []; let same = 0;
    for(let i=rd.s;i<rd.s+W;i++) if(a[i]!=null && b[i]!=null && !estFor(rd, k, i)){x.push(a[i]); y.push(b[i]); if(i>rd.s && b[i]===b[i-1]) same++}
    if(x.length < 60 || same > W*.2) continue;
    const mx = x.reduce((p,c)=>p+c)/x.length, my = y.reduce((p,c)=>p+c)/y.length; let sxy=0, sxx=0, syy=0;
    x.forEach((v,i)=>{sxy+=(v-mx)*(y[i]-my); sxx+=(v-mx)**2; syy+=(y[i]-my)**2});
    const c = sxx && syy ? sxy/Math.sqrt(sxx*syy) : 0; if(c > bc && Math.abs(mx-my) <= 1.5){bc = c; best = k} }
  return twinCache[key] = best && bc >= .85 ? {k:best, corr:bc} : null;
}
function autoFacts(k, s, max=2){
  const a = D.series[k], out = [];
  let pk = s, tr = s;
  for(let i=s;i<s+W;i++) if(a[i]!=null){ if(a[pk]==null||a[i]>a[pk]) pk=i; if(a[tr]==null||a[i]<a[tr]) tr=i }
  out.push(`Over these ten years its 10-year yield peaked at ${fmt(a[pk])} in ${mlong(pk)} and bottomed at ${fmt(a[tr])} in ${mlong(tr)}.`);
  const extra = [];
  const neg = a.slice(s, s+W).filter(v=>v!=null && v<0).length;
  if(neg) extra.push(`It was below zero for ${neg} of the 120 months.`);
  const peers = keys.filter(c=>D.series[c][pk]!=null);
  if(peers.length >= 5 && peers.every(c=>D.series[c][pk] <= a[pk])) extra.push(`In ${mlong(pk)} that was the highest yield of the ${peers.length} countries in the game with data that month.`);
  let bi = -1, bd = 0; for(let i=s;i+12<s+W;i++) if(a[i]!=null && a[i+12]!=null && Math.abs(a[i+12]-a[i]) > Math.abs(bd)){bd = a[i+12]-a[i]; bi = i}
  if(bi >= 0) extra.push(`Its biggest 12-month move: ${bd>0?"+":"−"}${Math.abs(bd).toFixed(2)} points, from ${mlabel(bi)} to ${mlabel(bi+12)}.`);
  return out.concat(extra).slice(0, max);
}

/* ---------- actions ---------- */
const rd = () => plan[sess.cur], rs = () => sess.rs[sess.cur];
function finishRound(pts){
  const s = rs(); if(s.done) return;
  const before = sess.rs.slice(0, sess.cur).some(x=>x.done) ? rungOf(sess.score) : null;
  s.done = true; s.pts = pts; s.before = before;
  const r0 = rd(); s.nt = r0.t !== "hl" && r0.ep == null ? (storyNote(r0) >= 0 ? storyNote(r0) : noteFor(r0.c, r0.s)) : -1;
  sess.score = Math.max(0, sess.score + pts);
  if(sess.cur === ROUNDS-1){ sess.done = true; viewingDone = true; if(mode === "daily") recordStats() }
  save(); revealAnim = true;
  if(pts > 0){SFX.kaching(); setTimeout(SFX.stamp, 260)} else {SFX.growl(); setTimeout(SFX.stamp, 380)}
  render();
  setTimeout(()=>{ const r = $("reveal"); if(r && !r.hidden) r.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block:"nearest"}) }, 120);
}
function guessCountry(code){
  const r = rd(), s = rs(), msg = $("msg"); msg.textContent = "";
  if(!code){const m = matches(); if(m.length === 1) code = m[0];
    else { const all = matchAll(); msg.textContent = m.length ? "Pick one of the countries below."
      : all.length ? `${all.length === 1 ? name(all[0].k) + " has" : "Those countries have"} no data for ${yearsOf(r)}, so ${all.length === 1 ? "it" : "they"} can't be the answer. No coupon used.`
      : "That country isn't in the game. Start typing a name and pick from the suggestions."; return}}
  if(s.g.includes(code)){msg.textContent = `You already guessed ${name(code)}.`; return}
  if(!hasData(r, code)){msg.textContent = `${name(code)} has no data for ${yearsOf(r)}, so it can't be the answer. No coupon used.`; return}
  const part = partialFrom(r, code);
  if(part != null && pendingPartial !== sess.cur+":"+code){ pendingPartial = sess.cur+":"+code;
    msg.textContent = `${name(code)} only has data for part of this window (from ${yearOf(part)}). Press Guess again to use a coupon on it.`; return }
  pendingPartial = null;
  s.g.push(code); s.seq.push({k:"g", v:code}); $("q").value = ""; browsing = false;
  if(code === r.c) finishRound(ptsFor(s.seq.length));
  else if(s.seq.length >= COUPONS) finishRound(0);
  else {SFX.bonk(); save(); render(); $("q").focus()}
}
function guessYear(raw){
  const r = rd(), s = rs(), msg = $("msg"); msg.textContent = "";
  const y = parseInt(raw, 10), ans = yearOf(r.pk);
  if(!(y >= 1950 && y <= 2026)){msg.textContent = "Type a year between 1950 and 2026."; return}
  if(s.g.includes(y)){msg.textContent = `You already tried ${y}.`; return}
  s.g.push(y); s.seq.push({k:"g", v:y}); $("q").value = "";
  if(y === ans) finishRound(ptsFor(s.seq.length));
  else if(Math.abs(y-ans) === 1) finishRound(Math.max(1, ptsFor(s.seq.length)-2));
  else if(s.seq.length >= COUPONS) finishRound(0);
  else {SFX.bonk(); save(); render(); $("q").focus()}
}
function answerHL(code){
  const r = rd(), s = rs(); if(s.done || s.g.length !== viewQ || viewQ >= r.qs.length) return;
  const q = r.qs[viewQ]; s.g.push(code);
  const other = code === q.a ? q.b : q.a, right = D.series[code][q.m] >= D.series[other][q.m];
  if(s.g.length >= r.qs.length){
    const n = s.g.filter((c,i)=>{const qq=r.qs[i], o=c===qq.a?qq.b:qq.a; return D.series[c][qq.m] >= D.series[o][qq.m]}).length;
    s.right = n; finishRound(n === 3 ? 4 : n);
  } else {right ? SFX.ding() : SFX.bonk(); save(); render()}
}
function useHint(type){
  const s = rs(); if(s.done || s.h.includes(type) || s.seq.length >= COUPONS-1) return;
  s.h.push(type); s.seq.push({k:"h", v:type}); SFX.click(); save(); render();
}
function nextRound(){
  if(sess.cur >= ROUNDS-1){ openEnd(true); return }
  sess.cur++; viewQ = 0; save(); render(); window.scrollTo({top:0, behavior:"auto"}); SFX.click();
  const inp = $("q"); if(inp && !$("form").hidden) inp.focus({preventScroll:true});
}
function start(){
  ac(); SFX.bell(); if(prefs.mus && !musTimer) musicStart();
  sess.started = true; atHome = false; viewQ = rs().done ? 0 : rs().g.length; save();
  if(sess.done){ render(); openEnd(); return }
  render();
  const inp = $("q"); if(inp && !$("form").hidden) inp.focus({preventScroll:true});
}

/* ---------- stats ---------- */
function streakNow(){ const S = store.get("spreadle-stats2"); return S && S.s && (S.last === dayN || S.last === dayN-1) ? S.s : 0 }
function recordStats(){
  const S = store.get("spreadle-stats2") || {p:0, s:0, b:0, ig:0, last:0, dist:{}};
  if(S.last === dayN) return;
  const rr = RATINGS[rungOf(sess.score)].r;
  S.p++; S.s = S.last === dayN-1 ? S.s+1 : 1; S.b = Math.max(S.b, S.s); S.last = dayN;
  if(rungOf(sess.score) >= 5) S.ig++;
  S.dist[rr] = (S.dist[rr]||0)+1; store.set("spreadle-stats2", S);
}

/* ---------- chart ---------- */
function niceStep(raw){ const mag = 10**Math.floor(Math.log10(raw)); return [1,2,2.5,5,10].map(m=>m*mag).find(m=>m>=raw) }
function drawChart(svg, tip, cfg){
  const Wd = svg.clientWidth, H = svg.clientHeight; if(!Wd || !H) return; const small = Wd < 520;
  const {from, to, lines, band, marker, vline, years = true, unit = "%"} = cfg;
  let lo = 1e9, hi = -1e9;
  for(const L of lines) for(let i=from;i<=to;i++){const v = L.v[i]; if(v!=null){lo=Math.min(lo,v); hi=Math.max(hi,v)}}
  if(lo > hi){lo = 0; hi = 1}
  const pad = Math.max(.2, (hi-lo)*.1); lo -= pad; hi += pad;
  const labelled = lines.some(l=>l.label), Lm = small ? 40 : 50, R = labelled ? (small ? 30 : 40) : 12, T = 10, B = years ? 26 : 14;
  const X = i => Lm + (i-from)/Math.max(1,to-from)*(Wd-Lm-R), Y = v => T + (hi-v)/(hi-lo)*(H-T-B);
  let step = niceStep((hi-lo)/(small ? 5 : 6)); for(let k=0;k<3 && (hi-lo)/step < 3.5;k++) step = niceStep(step/2.01);
  let g = "";
  for(let v=Math.ceil(lo/step)*step; v<=hi+1e-9; v+=step){const y = Y(v).toFixed(1), z = Math.abs(v) < 1e-9, t = +v.toFixed(2);
    g += `<line x1="${Lm}" x2="${Wd-R}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="${z?1.6:.8}"/><text x="${Lm-6}" y="${+y+4}" text-anchor="end" font-size="12" fill="var(--ink2)">${unit==="%" ? t+"%" : (t>0?"+":"")+t}</text>`}
  const span = (to-from)/12, ys = span>40 ? (small?20:10) : span>15 ? (small?10:5) : (small?4:2);
  for(let i=from;i<=to;i++){ if((M0+i)%12) continue; const y = yearOf(i);
    if(years){ if(y%ys===0) g += `<line x1="${X(i)}" x2="${X(i)}" y1="${H-B}" y2="${H-B+4}" stroke="var(--ink2)"/><text x="${X(i)}" y="${H-6}" text-anchor="${X(i) > Wd-R-16 ? "end" : "middle"}" font-size="12" fill="var(--ink2)">${y}</text>` }
    else g += `<line x1="${X(i)}" x2="${X(i)}" y1="${H-B}" y2="${H-B+5}" stroke="var(--ink2)"/>` }
  if(band){const x0 = X(band[0]), x1 = X(band[1]);
    g += `<rect x="${x0}" y="${T}" width="${x1-x0}" height="${H-T-B}" fill="var(--stamp)" opacity=".08"/><line x1="${x0}" x2="${x0}" y1="${T}" y2="${H-B}" stroke="var(--stamp)" stroke-dasharray="4 3"/><line x1="${x1}" x2="${x1}" y1="${T}" y2="${H-B}" stroke="var(--stamp)" stroke-dasharray="4 3"/>`}
  if(vline != null) g += `<line x1="${X(vline)}" x2="${X(vline)}" y1="${T}" y2="${H-B}" stroke="var(--ink2)" stroke-dasharray="3 3"/>`;
  const path = (arr, p, q) => {let d = "", pen = false; for(let i=p;i<=q;i++){ if(arr[i]==null){pen=false; continue} d += (pen?"L":"M")+X(i).toFixed(1)+" "+Y(arr[i]).toFixed(1); pen = true } return d};
  const labs = [];
  for(const L of lines){
    const p = Math.max(from, L.from ?? from), q = Math.min(to, L.to ?? to), d = path(L.v, p, q); if(!d) continue;
    const st = L.cls === "main" ? `stroke="var(--ink)" stroke-width="2.4"` : L.cls === "est" ? `stroke="var(--ghost)" stroke-width="1.6" stroke-dasharray="1 4" stroke-linecap="round"` : L.cls === "alt" ? `stroke="var(--stamp)" stroke-width="2.2"` : L.cls === "past" ? `stroke="var(--ghost)" stroke-width="1.4"` : `stroke="var(--ghost)" stroke-width="1.4" stroke-dasharray="4 3"`;
    g += `<path d="${d}" fill="none" ${st} stroke-linejoin="round"/>`;
    if(L.label){let j = q; while(j>p && L.v[j]==null) j--; labs.push({t:L.label, y:Y(L.v[j]), c: L.cls==="alt" ? "var(--stamp)" : L.cls==="main" ? "var(--ink)" : "var(--ghost)"})}
  }
  labs.sort((a,b)=>a.y-b.y); for(let i=1;i<labs.length;i++) labs[i].y = Math.max(labs[i].y, labs[i-1].y+13);
  g += labs.map(l=>`<text x="${Wd-R+5}" y="${Math.min(H-B, Math.max(T+8, l.y+4)).toFixed(1)}" font-size="12" font-weight="600" fill="${l.c}">${esc(l.t)}</text>`).join("");
  if(marker){g += `<circle cx="${X(marker.i)}" cy="${Y(marker.v)}" r="9" fill="none" stroke="var(--stamp)" stroke-width="2"/><circle cx="${X(marker.i)}" cy="${Y(marker.v)}" r="3.5" fill="var(--stamp)"/>`}
  g += `<line class="hx" y1="${T}" y2="${H-B}" stroke="var(--ink2)" opacity="0"/><circle class="hd" r="4" fill="var(--stamp)" opacity="0"/>`;
  svg.innerHTML = g;
  const main = lines.find(l=>l.cls==="main") || lines[0], hx = svg.querySelector(".hx"), hd = svg.querySelector(".hd");
  svg.onpointermove = e => { const rc = svg.getBoundingClientRect(), i = Math.round(from + (e.clientX-rc.left-Lm)/(Wd-Lm-R)*(to-from)), v = main.v[i];
    if(i<from || i>to || v==null){tip.style.opacity = 0; return}
    hx.setAttribute("x1", X(i)); hx.setAttribute("x2", X(i)); hx.setAttribute("opacity", .6); hd.setAttribute("cx", X(i)); hd.setAttribute("cy", Y(v)); hd.setAttribute("opacity", 1);
    const val = unit === "%" ? fmt(v) : fmtPts(v);
    tip.textContent = years ? `${mlabel(i)}: ${val}` : val; tip.style.opacity = 1;
    tip.style.left = Math.min(Wd-tip.offsetWidth-4, Math.max(4, X(i)-tip.offsetWidth/2)) + "px" };
  svg.onpointerleave = () => { tip.style.opacity = 0; hx.setAttribute("opacity", 0); hd.setAttribute("opacity", 0) };
}
function firstLast(a){ let f = 0, l = a.length-1; while(f<l && a[f]==null) f++; while(l>f && a[l]==null) l--; return [f, l] }
function drawMain(){
  const r = rd(), s = rs(), svg = $("chart"), tip = $("tip");
  if(r.t === "hl"){
    const q = r.qs[Math.min(viewQ, r.qs.length-1)], answered = s.g.length > viewQ || s.done;
    $("fig").hidden = !answered; if(!answered) return;
    const from = Math.max(0, q.m-36), to = Math.min(CUT, q.m+36);
    drawChart(svg, tip, {from, to, vline:q.m, lines:[{v:D.series[q.a], cls:"main", label:q.a}, {v:D.series[q.b], cls:"alt", label:q.b}]});
    return;
  }
  $("fig").hidden = false;
  const zoom = s.h.includes("zoom");
  let from = r.s, to = r.s+W-1;
  if(zoom){ const a = seriesFor(r, r.c), real = i => a[i]!=null && !estFor(r, r.c, i);
    while(from > r.s-60 && from > 0 && real(from-1)) from--; while(to < r.s+W-1+60 && to < CUT && real(to+1)) to++ }
  const lines = [];
  if(r.t !== "year") for(const c of s.g){ if(c === r.c || !hasData(r, c)) continue; lines.push({v:seriesFor(r, c), cls:"ghost", label:c, from:r.s, to:r.s+W-1}) }
  if(r.t !== "year" && s.h.includes("twin")){ const tw = twinOf(r); if(tw && !s.g.includes(tw.k)) lines.push({v:seriesFor(r, tw.k), cls:"alt", label:tw.k, from:r.s, to:r.s+W-1}) }
  lines.push({v:seriesFor(r, r.c), cls:"main", label: s.done && r.t !== "year" ? r.c : null});
  const cfg = {from, to, lines, unit: r.t === "spread" ? "pts" : "%", years: r.t !== "year" || s.done};
  if(zoom) cfg.band = [r.s, r.s+W-1];
  if(r.t === "year") cfg.marker = {i:r.pk, v:D.series[r.c][r.pk]};
  drawChart(svg, tip, cfg);
}
function drawHist(){
  const r = rd(); if($("hist").hidden || r.t === "hl") return;
  const a = D.series[r.c], [f, l] = firstLast(a);
  const em = EST[r.c], hasEst = em && em.some((x,i)=>x && i>=f && i<=l);
  const real = hasEst ? a.map((v,i)=>em[i] ? null : v) : a, est = hasEst ? a.map((v,i)=>em[i] || (em[i-1] || em[i+1]) ? v : null) : null;
  const lines = [{v:real, cls:"past"}]; if(hasEst) lines.unshift({v:est, cls:"est"});
  lines.push({v:a, cls:"main", from:r.s, to:r.s+W-1});
  drawChart($("histChart"), $("histTip"), {from:f, to:l, band:[r.s, r.s+W-1], lines});
  $("histHead").textContent = `${name(r.c)}, ${mlabel(f)} to ${mlabel(l)}. The shaded band is this bond's window.${hasEst ? " Dotted stretches are estimates or series that aren't true 10-year benchmarks: they can be guessed but are never the answer." : ""}`;
}
function guil(svg){ const w = svg.clientWidth || 800, h = svg.clientHeight || 86; let p = "";
  const n = h < 30 ? 4 : 9;
  for(let k=0;k<n;k++){let d = ""; for(let x=0;x<=w;x+=6){const y = h/2 + Math.sin(x/23+k*.7)*h*.32*Math.cos(x/140+k) + Math.sin(x/9+k)*(h<30?1.5:3); d += (x?"L":"M")+x+" "+y.toFixed(1)}
    p += `<path d="${d}" fill="none" stroke="var(--ink)" stroke-opacity="${.18+k%3*.08}" stroke-width=".8"/>`}
  svg.innerHTML = p }

/* ---------- rendering ---------- */
// every country with data can be guessed, including guess-only ones (like Iceland) that are never the answer
const guessable = () => Object.keys(C).filter(k=>D.series[k]);
function resolve(t){ t = t.trim().toLowerCase(); if(!t) return null; if(ALIAS[t] && D.series[ALIAS[t]]) return ALIAS[t];
  const up = t.toUpperCase(); if(C[up] && D.series[up]) return up; return guessable().find(k=>name(k).toLowerCase()===t) || null }
// browsing: the full country list is open (only from the "All countries" button)
let browsing = false;
const REGION_ORDER = ["Northern Europe","Western Europe","Southern Europe","Eastern Europe","Americas","Asia-Pacific","Middle East and Africa"];
function matchAll(){ const t = $("q").value.trim().toLowerCase(), r = rd(), s = rs(); if((!t && !browsing) || r.t==="year" || r.t==="hl") return [];
  const hit = k => !t || name(k).toLowerCase().includes(t) || k.toLowerCase()===t || ALIAS[t]===k, pre = k => name(k).toLowerCase().startsWith(t) ? 0 : 1;
  const out = guessable().filter(k=>!s.g.includes(k) && hit(k)).map(k=>({k, ok: hasData(r,k)}));
  if(!t) return out.sort((p,q)=>name(p.k).localeCompare(name(q.k)));
  return out.sort((p,q)=>(q.ok-p.ok) || (pre(p.k)-pre(q.k))).slice(0, browsing ? 99 : 6) }
function matches(){ return matchAll().filter(m=>m.ok).map(m=>m.k) }
const yearsOf = r => `${yearOf(r.s)} to ${yearOf(r.s+W-1)}`;
let pendingPartial = null;
// first month with data when a country covers less than 80% of the window, else null
function partialFrom(r, k){ if(k === r.c) return null; const b = seriesFor(r, k); let n = 0, f = null;
  for(let i=r.s;i<r.s+W;i++) if(b[i]!=null){ n++; if(f == null) f = i } return n < W*.8 ? f : null }
function renderSugg(){ const r = rd(), list = matchAll(), all = browsing && !$("q").value.trim();
  const chip = m => m.ok ? `<li><button type="button" data-k="${m.k}">${esc(name(m.k))}${partialFrom(r, m.k) != null ? `<span class="part">from ${yearOf(partialFrom(r, m.k))}</span>` : ""}</button></li>`
    : `<li><button type="button" class="nodata" disabled title="No data for ${yearsOf(r)}">${esc(name(m.k))}<span>no data</span></button></li>`;
  $("sugg").classList.toggle("browse", all);
  $("sugg").innerHTML = all
    ? REGION_ORDER.map(g=>{ const ms = list.filter(m=>C[m.k][1]===g); return ms.length ? `<li class="grp">${g}</li>` + ms.map(chip).join("") : "" }).join("")
    : list.map(chip).join("");
  const ab = $("allBtn"); if(ab){ ab.setAttribute("aria-expanded", browsing); ab.hidden = r.t === "year" || r.t === "hl" } }

function renderHeader(){
  $("sessionLbl").textContent = mode === "daily" ? `Session no. ${dayN}, ${dayLabel}` : "Unlimited session, not counted";
  $("sndBtn").setAttribute("aria-pressed", prefs.snd); $("musBtn").setAttribute("aria-pressed", prefs.mus);
}
function roundTier(i){ const s = sess.rs[i]; if(!s.done) return null; return s.pts >= 4 ? 0 : s.pts === 3 ? 1 : s.pts >= 1 ? 2 : 3 }
// each finished bond is a market candle: solved on coupon 1, 2, 3 = big, medium, small green; coupon 4 = flat;
// coupon 5 = small red; missed = big red. Higher or lower: 3, 2, 1, 0 right = big green, small green, small red, big red.
// Guess the year one year off counts one size smaller than the exact year.
const CANDLES = [["up","big"],["up","mid"],["up","small"],["flat","flat"],["down","small"],["down","big"]];
const CANDLE_TXT = {"up big":"big green candle","up mid":"medium green candle","up small":"small green candle","flat flat":"flat candle","down small":"small red candle","down big":"big red candle"};
function candleOf(i){ const s = sess.rs[i], r = plan[i]; if(!s.done) return null;
  if(r.t === "hl"){ const n = s.right ?? Math.min(3, s.pts); return CANDLES[[5,4,2,0][n]] }
  if(s.pts <= 0) return CANDLES[5];
  let k = Math.min(4, s.seq.length - 1);
  if(r.t === "year" && s.pts < ptsFor(s.seq.length)) k = Math.min(4, k + 1);
  return CANDLES[k] }
function renderPips(){
  $("pips").innerHTML = plan.map((r,i)=>{const c = candleOf(i), cur = i===sess.cur && !sess.done;
    return `<li class="pip${cur?" cur":""}" aria-label="Bond ${i+1}${c ? ": " + CANDLE_TXT[c.join(" ")] : cur ? ": in play" : ""}"><span class="wick"><span class="candle${c ? " " + c.join(" ") : ""}"></span></span>${i+1}</li>`}).join("");
  const r = rd(), s = rs(), n = r.t === "hl" ? 0 : COUPONS;
  $("tokens").innerHTML = n ? `<span>Coupons left</span>` + Array.from({length:n},(_,i)=>`<svg class="${i>=n-s.seq.length?"used":""}"><use href="#coin"/></svg>`).join("") : "";
}
function renderLadder(flash){
  const anyDone = sess.rs.some(x=>x.done), cur = anyDone ? rungOf(sess.score) : -1;
  $("rungs").innerHTML = RATINGS.map((x,i)=>({...x,i})).reverse().map(x=>`<li class="rung${x.i>=5?" ig":""}${x.i===5?" igline":""}${x.i===cur?" cur":""}${x.i===cur&&flash?" flash":""}"><span class="rt">${x.r}</span><span class="rd">${x.d}</span><span class="rl">${esc(x.l)}</span>${x.i===cur?`<svg class="bullmark" aria-hidden="true"><use href="#bull"/></svg>`:""}</li>`).join("");
  $("ldNote").textContent = anyDone ? `${sess.score} of ${MAXPTS} points: ${gradeOf(sess.score)}. ${cur>=5 ? "Investment grade." : `${IG-sess.score} more to reach investment grade.`}` : `Not rated yet. 4 points per bond on a first guess; only a perfect ${MAXPTS} is AAA.`;
}
function renderLanding(){
  const done = sess.done, inprog = sess.started && !done && sess.rs.some(x=>x.done || x.g.length);
  $("slots").innerHTML = plan.map((r,i)=>`<li><b>${i+1}</b>${KIND[r.k] || "Bond"}</li>`).join("");
  $("startBtn").textContent = done ? "See today's results" : inprog ? `Resume session, bond ${Math.min(5, sess.cur + (sess.rs[sess.cur].done ? 2 : 1))} of 5` : "Ring the opening bell";
  const st = streakNow(), stTxt = st ? ` Streak: ${st} day${st>1?"s":""}.` : "";
  $("landNote").textContent = done ? `Today's rating: ${gradeOf(sess.score)} (${sess.score} of ${MAXPTS}). Next session in ${untilMidnight()}.${stTxt}` : `Session no. ${dayN}, ${dayLabel}. Same five bonds for everyone today.${stTxt}`;
}
function renderRound(){
  const r = rd(), s = rs(), done = s.done;
  const kind = KIND[r.k] || "Bond";
  $("kicker").textContent = `Bond ${sess.cur+1} of 5: ${kind}`;
  const winTxt = `${mlabel(r.s)} to ${mlabel(r.s+W-1)}`;
  let q = "", facts = [];
  const region = s.h.includes("region") || done, twinOn = s.h.includes("twin") || done;
  const tw = (r.t === "country" || r.t === "spread") ? twinOf(r) : null;
  const twinTxt = tw ? `${name(tw.k)}, shape ${Math.min(99, Math.floor(tw.corr*100))}% alike` : "No close twin";
  if(r.t === "country" || r.t === "spread"){
    q = r.t === "spread" ? "Whose spread over Germany is this?" : "Which country issued this bond?";
    facts = [[r.t==="spread" ? "Chart" : "Instrument", r.t==="spread" ? "10-year yield minus Germany's, in points" : "10-year government bond yield"], ["Window", winTxt],
      ["Region", region ? C[r.c][1] : null], ["Closest twin", twinOn ? twinTxt : null]];
  } else if(r.t === "year"){
    const ep = r.ep != null ? epOf(r) : null;
    q = ep ? `${name(r.c)}: in what year was the marked moment?` : `${name(r.c)}: in what year did the marked ${r.ym === "low" ? "low" : "peak"} happen?`;
    facts = [["Instrument", `${name(r.c)}'s 10-year yield`], ["Window", done ? winTxt : "10 years, dates hidden"], ["Marked point", done ? `${fmt(D.series[r.c][r.pk])}, ${mlong(r.pk)}` : fmt(D.series[r.c][r.pk])], ["Decade", s.h.includes("decade")||done ? `${Math.floor(yearOf(r.pk)/10)*10}s` : null]];
    const sn = ep ? -1 : storyNote(r), story = ep ? ep.q.replace(/^The marked point is /, "").replace(/^./, c=>c.toUpperCase()) : sn >= 0 ? NOTES[sn].h : null;
    if(story) facts.push(["The story", s.h.includes("story")||done ? story : null]);
  } else {
    const qi = Math.min(viewQ, r.qs.length-1), qq = r.qs[qi];
    q = `Who paid more to borrow for 10 years in ${mlong(qq.m)}?`;
    facts = [["Instrument", "10-year government bond yield"], ["Question", `${qi+1} of ${r.qs.length}`]];
  }
  $("question").textContent = q;
  $("facts").innerHTML = facts.map(([dt,dd])=>`<div><dt>${dt}</dt><dd class="${dd==null?"locked":""}">${dd==null ? "Hidden, costs a coupon" : esc(dd)}</dd></div>`).join("");

  // stamp
  const st = $("stamp");
  if(done){
    let big = s.pts > 0 ? "Redeemed" : "Defaulted", small = "";
    if(r.t === "hl"){big = `${s.right ?? Math.min(3, s.pts)} of 3`; small = "correct"}
    else if(s.pts > 0) small = `${s.seq.length} coupon${s.seq.length>1?"s":""} used`;
    else small = r.t === "year" ? `it was ${yearOf(r.pk)}` : `it was ${name(r.c)}`;
    st.innerHTML = `${big}<small>${small}</small>`; st.classList.add("on"); st.classList.toggle("anim", revealAnim);
  } else st.className = "stamp";

  // controls
  const isHL = r.t === "hl";
  $("form").hidden = done || isHL;
  $("hlq").hidden = !isHL;
  if(isHL) renderHL();
  if(!done && !isHL){
    $("qLabel").textContent = r.t === "year" ? "Your guess: a year (exact scores most; one year off still counts)" : "Your guess: a country";
    const inp = $("q"); inp.placeholder = r.t === "year" ? "e.g. 1981" : "Type a country"; inp.inputMode = r.t === "year" ? "numeric" : "text";
    $("pool").textContent = r.t === "year" ? "Each wrong guess tells you earlier or later." : `${guessable().filter(k=>hasData(r,k)).length} of ${guessable().length} countries have data in this window.`;
    renderSugg();
  }
  // hints
  const hs = r.t === "year" ? [["decade","Decade"], ...(r.ep != null || storyNote(r) >= 0 ? [["story","The story"]] : [])] : isHL ? [] : [["region","Region"],["twin","Closest twin"],["zoom","Zoom out 5 years"]];
  $("hints").hidden = done || !hs.length;
  const canHint = s.seq.length < COUPONS-1;
  $("hints").innerHTML = hs.length ? `<span>${canHint ? "A hint costs one coupon:" : "Keep your last coupon for a guess."}</span>` + hs.map(([k,l])=>`<button type="button" data-h="${k}" ${s.h.includes(k)||!canHint||(k==="twin"&&!tw)?"disabled":""} ${k==="twin"&&!tw?'title="No other country moved closely enough with this one"':""}><svg aria-hidden="true"><use href="#coin"/></svg>${l}</button>`).join("") : "";

  // coupons
  let h = "";
  const HN = {region:"Region", twin:"Closest twin", zoom:"Zoom out 5 years", decade:"Decade", story:"The story"};
  for(let i=0;i<(isHL ? QS : COUPONS);i++){
    const e = isHL ? (s.g[i] != null ? {k:"g", v:s.g[i]} : null) : s.seq[i], g = e && e.k === "g" ? e.v : null;
    if(e && e.k === "h"){ h += `<li class="coupon used hintc"><div class="no">Coupon ${i+1}</div><div class="who"><span class="seal"></span>Hint</div><div class="nums"><span class="nd">${HN[e.v]||e.v}</span></div></li>`; continue }
    if(g == null){ h += `<li class="coupon empty"><div class="no">${isHL ? `Question ${i+1}` : `Coupon ${i+1}`}</div><div>${isHL ? "Not answered" : "Unclipped"}</div></li>`; continue }
    if(isHL){ const qq = r.qs[i], o = g===qq.a ? qq.b : qq.a, ok = D.series[g][qq.m] >= D.series[o][qq.m];
      h += `<li class="coupon used"><div class="no">Question ${i+1}, ${mlabel(qq.m)}</div><div class="who"><span class="seal" style="--c:${ok?TIERC[0]:TIERC[3]}"></span>${ok?"Right":"Wrong"}</div><div class="nums"><span class="nd">${esc(name(qq.a))} ${fmt(D.series[qq.a][qq.m])}, ${esc(name(qq.b))} ${fmt(D.series[qq.b][qq.m])}</span></div></li>`; continue }
    if(r.t === "year"){ const ans = yearOf(r.pk), d = ans-g, ok = Math.abs(d) <= 1, ad = Math.abs(d);
      const band = ad >= 10 ? "10 or more years" : ad >= 5 ? "5 to 9 years" : "2 to 4 years";
      h += `<li class="coupon used"><div class="no">Coupon ${i+1}</div><div class="who"><span class="seal" style="--c:${ok?TIERC[0]:ad<5?TIERC[2]:TIERC[3]}"></span>${g}</div><div class="nums"><span class="nd">${d === 0 ? "Exact" : ok ? "One year off, counts" : `${d>0?"Later":"Earlier"}, by ${band}`}</span></div></li>`; continue }
    const c = compare(r, g); let nums;
    if(c.tier === 0) nums = "<span>Correct</span>";
    else if(c.tier === 4) nums = "<span class='nd'>No data in this window</span>";
    else {const bp = Math.round(c.gap*100); nums = `<span><span aria-hidden="true">${bp>=0?"↑":"↓"}</span> Answer ${Math.abs(bp)} bp ${bp>=0?"higher":"lower"}</span><span>Shape ${Math.max(0, Math.min(99, Math.floor(c.corr*100)))}%</span>${c.est ? `<span class="estn">Guess-only data</span>` : ""}`}
    h += `<li class="coupon used"><div class="no">Coupon ${i+1}</div><div class="who"><span class="seal" style="--c:${TIERC[c.tier]}"></span>${esc(name(g))}</div><div class="nums">${nums}</div></li>`;
  }
  $("coupons").innerHTML = h; $("coupons").classList.toggle("three", isHL);

  renderReveal();
  revealAnim = false;
}
function renderHL(){
  const r = rd(), s = rs(), qi = Math.min(viewQ, r.qs.length-1), q = r.qs[qi], answered = s.g.length > qi;
  let h = [q.a, q.b].map(c=>{let cls = "", sub = "";
    if(answered){ const o = c===q.a ? q.b : q.a, win = D.series[c][q.m] >= D.series[o][q.m]; cls = s.g[qi]===c ? (win ? "right" : "wrong") : (win ? "right" : ""); sub = `<small>${fmt(D.series[c][q.m])}</small>` }
    return `<button type="button" data-hl="${c}" class="${cls}" ${answered?"disabled":""}>${esc(name(c))}${sub}</button>`}).join("");
  if(answered && !s.done && qi < r.qs.length-1) h += `<button type="button" class="hlnext" id="hlNext">Next question</button>`;
  $("hlq").innerHTML = h;
}
function renderReveal(){
  const r = rd(), s = rs(), box = $("reveal");
  box.hidden = !s.done; if(!s.done){ $("hist").hidden = true; $("histBtn").setAttribute("aria-expanded","false"); $("histBtn").textContent = "Show full history"; return }
  box.classList.toggle("anim", revealAnim);
  const ep = r.ep != null && r.t !== "year" ? epOf(r) : null;
  $("rvEp").textContent = r.t === "year" && r.ep != null ? `Twist: guess the year. ${epOf(r).t}` : ep ? `Headline: ${ep.t}` : r.t === "spread" ? "Twist: spread over Germany" : r.t === "year" ? "Twist: guess the year" : r.t === "hl" ? "Twist: higher or lower" : "";
  $("rvTitle").textContent = r.t === "hl" ? `${s.right ?? Math.min(3, s.pts)} of 3 right` : `${name(r.c)}, ${mlabel(r.s)} to ${mlabel(r.s+W-1)}`;
  const nDone = sess.rs.filter(x=>x.done).length;
  const move = nDone >= ROUNDS ? `Final rating: ${gradeOf(sess.score)}.` : `On course for ${gradeOf(Math.round(sess.score*ROUNDS/nDone))}.`;
  const dl = $("rvDelta");
  dl.textContent = s.pts > 0 ? `+${s.pts} point${s.pts>1?"s":""}. ${move}` : `No points this time: the bear wins this one. ${move}`;
  dl.className = "delta " + (s.pts > 0 ? "up" : "down");
  const m = $("rvMascot"); m.innerHTML = `<use href="#${s.pts>0?"bull":"bear"}"/>`; m.classList.remove("charge","swipe"); if(revealAnim){ void m.getBoundingClientRect(); m.classList.add(s.pts>0?"charge":"swipe") }
  let facts = [];
  const peakTxt = r.c ? fmt(D.series[r.c][peakOf(D.series[r.c], r.s)]) : null;
  if(ep) facts = [ep.f, ...(ep.f.includes(peakTxt) ? [] : autoFacts(r.c, r.s, 1))];
  else if(r.t === "spread"){ const sp = spreadOf(r.c), pk = peakOf(sp, r.s); facts = [`Its spread over Germany peaked at ${fmtPts(sp[pk]).replace(" pts"," points")} in ${mlong(pk)}.`, ...autoFacts(r.c, r.s, 1)] }
  else if(r.t === "year") facts = r.ep != null ? [`${mlong(r.pk)}: ${epOf(r).f}`] : [`The ${r.ym === "low" ? "low" : "peak"}: ${fmt(D.series[r.c][r.pk])} in ${mlong(r.pk)}.`, ...autoFacts(r.c, r.s, 2).slice(1)];
  else if(r.t === "hl") facts = r.qs.map(qq=>{const hiC = D.series[qq.a][qq.m] >= D.series[qq.b][qq.m] ? qq.a : qq.b, loC = hiC===qq.a ? qq.b : qq.a;
      return `${mlong(qq.m)}: ${name(hiC)} paid ${fmt(D.series[hiC][qq.m])}, ${name(loC)} ${fmt(D.series[loC][qq.m])}.`});
  else facts = autoFacts(r.c, r.s, 2);
  // a history note for this country and these years, when one exists (headline episodes already have theirs)
  const nt = s.nt != null && s.nt >= 0 ? NOTES[s.nt] : null;
  if(nt) facts = r.t === "spread" ? facts.slice(0, 1) : nt.f.includes(peakTxt) ? [] : facts.slice(0, 1);
  $("rvFacts").innerHTML = facts.map(f=>`<li>${esc(f)}</li>`).join("") + (nt ? `<li class="note"><b>Did you know?</b> ${esc(nt.f)}</li>` : "");
  $("nextBtn").textContent = sess.cur >= ROUNDS-1 ? "See your rating" : "Next bond";
  $("histBtn").hidden = r.t === "hl";
}
function render(){
  renderHeader();
  const showLanding = mode === "daily" && (atHome || !sess.started || (sess.done && !viewingDone));
  $("landing").hidden = !showLanding; $("game").hidden = showLanding; document.body.classList.toggle("onland", showLanding);
  renderLadder(revealAnim);
  if(showLanding){ renderLanding(); requestAnimationFrame(()=>guil(document.querySelector("#landing .guil"))); return }
  renderPips(); renderRound();
  requestAnimationFrame(()=>{ drawMain(); drawHist(); guil(document.querySelector(".strip .guil")) });
}

/* ---------- end dialog ---------- */
function shareText(){
  const used = sess.rs.reduce((n,x)=>n+(x.h||[]).length, 0), st = mode === "daily" ? streakNow() : 0;
  const row = sess.rs.map(x=>x.pts>0 ? EMO[x.pts] : "🟥").join("");
  return `SovSpreadle #${sess.n ?? "∞"}: ${gradeOf(sess.score)} (${sess.score}/${MAXPTS})${st > 1 ? ` 🔥${st}` : ""}\n${row}${used ? ` 💡${used}` : ""}${siteUrl() ? "\n" + siteUrl() : ""}`;
}
// the public address for the share text: the canonical link once a real domain is set, else this page's address
function siteUrl(){ const c = document.querySelector('link[rel="canonical"]')?.href;
  if(c && !c.includes("sovspreadle.example")) return c;
  return /^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname) && !/claude/.test(location.hostname) ? location.origin + location.pathname.replace(/index\.html$/, "") : "" }
function untilMidnight(){ const n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate()+1), ms = m-n; return `${Math.floor(ms/36e5)}h ${Math.floor(ms%36e5/6e4)}m` }
function openEnd(fresh){
  const ri = rungOf(sess.score), R = RATINGS[ri];
  $("endKicker").textContent = mode === "daily" ? `Session no. ${dayN} closed` : "Unlimited session closed";
  $("endRating").textContent = gradeOf(sess.score); $("endDesc").textContent = `${R.d}. ${sess.score} of ${MAXPTS} points.`;
  $("endMascot").innerHTML = `<use href="#${ri>=5?"bull":"bear"}"/>`;
  $("endMWrap").dataset.m = ri>=5 ? "bull" : "bear";
  $("endLog").innerHTML = plan.map((r,i)=>{const s = sess.rs[i], ep = r.ep!=null && r.t!=="year" ? epOf(r) : null;
    const what = r.t === "hl" ? "Higher or lower" : r.t === "year" ? `Guess the year: ${name(r.c)}, ${yearOf(r.pk)}` : `${r.t==="spread"?"Spread: ":""}${name(r.c)}, ${yearOf(r.s)} to ${yearOf(r.s+W-1)}`;
    return `<li><span>${s.pts>0?EMO[s.pts]:"🟥"}</span><span>${esc(what)}${ep?`<br><span class="lk">${esc(ep.t)}</span>`:""}</span><span class="pts">${s.pts>0?"+"+s.pts:"0"}</span></li>`}).join("");
  $("sharePre").textContent = shareText(); $("copyMsg").textContent = "";
  $("copyBtn").hidden = false;
  if(mode === "daily"){
    const S = store.get("spreadle-stats2") || {p:0,s:0,b:0,ig:0,dist:{}};
    $("stats").innerHTML = [["Played",S.p],["Investment grade",S.p?Math.round(S.ig/S.p*100)+"%":"0%"],["Streak",S.s],["Best streak",S.b]].map(([l,v])=>`<div><b>${v}</b><span>${l}</span></div>`).join("");
    const mx = Math.max(1, ...RATINGS.map(x=>S.dist[x.r]||0));
    $("dist").innerHTML = [...RATINGS].reverse().map(x=>`<div class="${x.r===R.r?"me":""}"><span>${x.r}</span><i style="width:${Math.max(4,(S.dist[x.r]||0)/mx*100)}%">${S.dist[x.r]||0}</i></div>`).join("");
    $("nextIn").textContent = `Next session in ${untilMidnight()}.`;
    $("endUnlim").textContent = "Play unlimited";
  } else { $("stats").innerHTML = ""; $("dist").innerHTML = ""; $("nextIn").textContent = "Unlimited sessions don't count toward your stats."; $("endUnlim").textContent = "New unlimited session" }
  const d = $("endDlg"); if(!d.open){ try{ d.showModal() }catch(e){ d.setAttribute("open","") } }
  $("endMascot").parentNode.classList.remove("rear","roar");
  if(fresh) setTimeout(playFinale, 350); else SFX.bell();
}
function closeDlg(d){ if(d.open){ try{ d.close() }catch(e){ d.removeAttribute("open") } } }

/* ---------- events ---------- */
$("form").addEventListener("submit", e => { e.preventDefault(); const r = rd(); if(rs().done) return;
  if(r.t === "year") guessYear($("q").value); else guessCountry(resolve($("q").value)) });
$("q").addEventListener("input", () => { $("msg").textContent = ""; pendingPartial = null; renderSugg() });
$("q").addEventListener("keydown", e => { if(e.key === "Escape" && browsing){ browsing = false; renderSugg() } });
$("allBtn").addEventListener("click", () => { browsing = !browsing; if(browsing) $("q").value = ""; renderSugg(); $("q").focus() });
$("sugg").addEventListener("click", e => { const b = e.target.closest("button"); if(b) guessCountry(b.dataset.k) });
$("hints").addEventListener("click", e => { const b = e.target.closest("button[data-h]"); if(b) useHint(b.dataset.h) });
$("hlq").addEventListener("click", e => { const b = e.target.closest("button"); if(!b) return;
  if(b.id === "hlNext"){ viewQ++; SFX.click(); render(); return } if(b.dataset.hl) answerHL(b.dataset.hl) });
$("nextBtn").addEventListener("click", nextRound);
$("histBtn").addEventListener("click", () => { const h = $("hist"), open = h.hidden; h.hidden = !open; $("histBtn").setAttribute("aria-expanded", open); $("histBtn").textContent = open ? "Hide full history" : "Show full history"; if(open) requestAnimationFrame(()=>{ drawHist(); h.scrollIntoView({behavior:"smooth", block:"nearest"}) }) });
$("startBtn").addEventListener("click", () => { if(sess.done){ viewingDone = true; atHome = false; render(); openEnd(); return } start() });
$("unlimBtn").addEventListener("click", () => { ac(); newUnlimited(); SFX.bell(); if(prefs.mus && !musTimer) musicStart(); render() });
$("endMWrap").addEventListener("click", playFinale);
$("endUnlim").addEventListener("click", () => { closeDlg($("endDlg")); newUnlimited(); SFX.bell(); render() });
$("homeBtn").addEventListener("click", () => { closeDlg($("endDlg")); loadDaily(); viewingDone = false; atHome = true; viewQ = 0; render() });
$("copyBtn").addEventListener("click", () => { const t = shareText(), m = $("copyMsg");
  navigator.clipboard.writeText(t).then(()=>m.textContent = "Copied. Paste it in your group chat.", ()=>m.textContent = "Copying isn't allowed here. Select the text above and copy it.") });
$("helpBtn").addEventListener("click", () => { const d = $("helpDlg"); try{ d.showModal() }catch(e){ d.setAttribute("open","") } });
document.querySelectorAll(".dlg").forEach(d => { d.addEventListener("click", e => { if(e.target.closest("[data-close]")) closeDlg(d);
  else if(e.target === d){ const rc = d.getBoundingClientRect(); if(e.clientX<rc.left||e.clientX>rc.right||e.clientY<rc.top||e.clientY>rc.bottom) closeDlg(d) } }) });
$("endDlg").addEventListener("close", () => { if(mode === "daily" && sess.done && !atHome){ viewingDone = true; render() } });
$("sndBtn").addEventListener("click", () => { prefs.snd = !prefs.snd; store.set("spreadle-prefs", prefs); if(prefs.snd){ ac(); SFX.click() } renderHeader() });
$("musBtn").addEventListener("click", () => { prefs.mus = !prefs.mus; store.set("spreadle-prefs", prefs); if(prefs.mus) musicStart(); else musicStop(); renderHeader() });
const ro = new ResizeObserver(() => { if(!plan || !sess) return; if(!$("game").hidden){ drawMain(); drawHist(); guil(document.querySelector(".strip .guil")) } else guil(document.querySelector("#landing .guil")) });
[$("fig"), document.querySelector(".fig.full"), document.querySelector("#landing .band")].forEach(el => ro.observe(el));

/* ---------- boot ---------- */
Promise.all([fetch("data.json").then(r=>{if(!r.ok) throw 0; return r.json()}), fetch("episodes.json").then(r=>{if(!r.ok) throw 0; return r.json()}),
  fetch("notes.json").then(r=>r.ok ? r.json() : []).catch(()=>[]), fetch("puzzles.json").then(r=>r.ok ? r.json() : null).catch(()=>null)])
  .then(([d, e, n, pz]) => { NOTES = n || [];
    prep(d, e); if(pz && pz.days) setFrozen(pz.days);
    const now = new Date();
    dayLabel = now.toLocaleDateString("en-GB", {weekday:"long", day:"numeric", month:"long", year:"numeric"});
    dayN = Math.max(1, Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - EPOCH)/864e5) + 1);
    loadDaily(); viewQ = rs().done ? 0 : rs().g.length; render();
    if(location.search.includes("debug")) window.__sp = {dailyPlan, gradeOf, get plan(){return plan}, get sess(){return sess}, name, get eps(){return EPS.length}};
  })
  .catch(() => { $("landNote").textContent = "The yield data didn't load. Reload the page to try again."; $("startBtn").disabled = true });
}
