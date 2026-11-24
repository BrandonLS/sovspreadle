/* SovSpreadle core: reference data, data prep and the puzzle generator. No DOM here, so the same file runs in
   the browser (loaded before app.js) and in Node (scripts/make_puzzles.mjs builds the frozen schedule). */
'use strict';
/* ---------- reference data ---------- */
const C = {
  US:["United States","Americas","US dollar"],CA:["Canada","Americas","Canadian dollar"],MX:["Mexico","Americas","Mexican peso"],CL:["Chile","Americas","Chilean peso"],
  DE:["Germany","Western Europe","Euro","Deutsche Mark before 1999"],FR:["France","Western Europe","Euro","franc before 1999"],IT:["Italy","Southern Europe","Euro","lira before 1999"],ES:["Spain","Southern Europe","Euro","peseta before 1999"],
  PT:["Portugal","Southern Europe","Euro","escudo before 1999"],GR:["Greece","Southern Europe","Euro","drachma before 2001"],IE:["Ireland","Western Europe","Euro","punt before 1999"],NL:["Netherlands","Western Europe","Euro","guilder before 1999"],
  BE:["Belgium","Western Europe","Euro","franc before 1999"],AT:["Austria","Western Europe","Euro","schilling before 1999"],FI:["Finland","Nordic and Baltic","Euro","markka before 1999"],LU:["Luxembourg","Western Europe","Euro","franc before 1999"],
  SK:["Slovakia","Central and Eastern Europe","Euro","koruna before 2009"],SI:["Slovenia","Central and Eastern Europe","Euro","tolar before 2007"],
  GB:["United Kingdom","Western Europe","Pound sterling"],CH:["Switzerland","Western Europe","Swiss franc"],SE:["Sweden","Nordic and Baltic","Swedish krona"],NO:["Norway","Nordic and Baltic","Norwegian krone"],
  DK:["Denmark","Nordic and Baltic","Danish krone"],IS:["Iceland","Nordic and Baltic","Icelandic krona"],PL:["Poland","Central and Eastern Europe","Polish zloty"],CZ:["Czechia","Central and Eastern Europe","Czech koruna"],
  HU:["Hungary","Central and Eastern Europe","Hungarian forint"],JP:["Japan","Asia-Pacific","Japanese yen"],AU:["Australia","Asia-Pacific","Australian dollar"],NZ:["New Zealand","Asia-Pacific","New Zealand dollar"],
  KR:["South Korea","Asia-Pacific","Korean won"],IN:["India","Asia-Pacific","Indian rupee"],MY:["Malaysia","Asia-Pacific","Malaysian ringgit"],TH:["Thailand","Asia-Pacific","Thai baht"],SG:["Singapore","Asia-Pacific","Singapore dollar"],
  BG:["Bulgaria","Central and Eastern Europe","Bulgarian lev"],CY:["Cyprus","Southern Europe","Euro","Cypriot pound before 2008"],HR:["Croatia","Southern Europe","Euro","kuna before 2023"],LV:["Latvia","Nordic and Baltic","Euro","lats before 2014"],MT:["Malta","Southern Europe","Euro","Maltese lira before 2008"],RO:["Romania","Central and Eastern Europe","Romanian leu"],
  CO:["Colombia","Americas","Colombian peso"],CR:["Costa Rica","Americas","Costa Rican colón"],IL:["Israel","Middle East and Africa","Israeli shekel"],ZA:["South Africa","Middle East and Africa","South African rand"],RU:["Russia","Central and Eastern Europe","Russian ruble"]
};
const ALIAS = {"south korea":"KR",uk:"GB",britain:"GB","great britain":"GB",england:"GB",usa:"US",us:"US",america:"US","czech republic":"CZ",korea:"KR",holland:"NL",swiss:"CH"};
const EASY = ["US","DE","GB","FR","IT","ES","JP","GR","CH"];
const MED = ["CA","AU","NL","BE","IE","PT","SE","NO","DK","AT","KR","PL","MX","ZA","IN"];
const HARD = ["FI","LU","IS","NZ","IL","CZ","HU","SK","SI","CL","RU","BG","CY","HR","LV","MT","RO","MY","TH","SG","CO","CR"];
const RATINGS = [
  {r:"D",d:"Default",l:"Russia defaulted on its ruble bonds in August 1998."},
  {r:"C",d:"Near default",l:"Moody's cut Greece to C in March 2012, during its restructuring."},
  {r:"CCC",d:"Substantial risk",l:"Default is a real possibility."},
  {r:"B",d:"Highly speculative",l:"One bad year from trouble."},
  {r:"BB",d:"Junk",l:"S&P cut Greece to BB+, junk, in April 2010."},
  {r:"BBB",d:"Investment grade",l:"BBB- is the lowest investment-grade rating."},
  {r:"A",d:"Upper medium grade",l:"S&P cut Japan to A+ in September 2015."},
  {r:"AA",d:"High grade",l:"S&P cut the US to AA+ in August 2011, its first downgrade."},
  {r:"AAA",d:"Prime",l:"Germany and Switzerland have long held this rating."}
];
const KIND = {headline:"Headline",easy:"Easy",medium:"Medium",hard:"Hard",spread:"Spread vs Germany",hl:"Higher or lower",year:"Guess the year"};
const W = 120, ROUNDS = 5, COUPONS = 5, QS = 3, EPOCH = Date.UTC(2026, 10, 22);
const ptsFor = used => used === 1 ? 4 : used === 2 ? 3 : used === 3 ? 2 : 1;
const MAXPTS = 20, IG = 11;
// one grade per point, like the agencies' notches; families (AA+, AA, AA- = AA) drive the ladder
const GRADES = ["D","C","C","CCC","CCC","B-","B","B+","BB-","BB","BB+","BBB-","BBB","BBB+","A-","A","A+","AA-","AA","AA+","AAA"];
const gradeOf = sc => GRADES[Math.max(0, Math.min(MAXPTS, sc))];
const MON = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const MONTH = "January February March April May June July August September October November December".split(" ");
const TIERC = ["var(--hit)","var(--close)","var(--near)","var(--far)","var(--none)"];
const EMO = {4:"🟩",3:"🟨",2:"🟧",1:"🟫"};

/* ---------- helpers ---------- */
const store = {get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const rngOf = a => () => {a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const hash = s => {let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const pick = (r, arr) => arr[Math.floor(r()*arr.length)];
const shuffle = (arr, r) => {for(let i=arr.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr};
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const name = k => C[k][0];

let D, Y0, M0, CUT, keys = [], valid = {}, validSet = {}, EPS = [], EST = {}, NOTES = [];
const ix = ym => (+ym.slice(0,4)-Y0)*12 + (+ym.slice(5,7)-1) - M0;
const yearOf = i => Y0 + Math.floor((M0+i)/12);
const mlabel = i => MON[(M0+i)%12] + " " + yearOf(i);
const mlong = i => MONTH[(M0+i)%12] + " " + yearOf(i);
const fmt = v => (Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1)) + "%";
const fmtPts = v => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2) + " pts";
const FAM = {D:0, C:1, CCC:2, B:3, BB:4, BBB:5, A:6, AA:7, AAA:8};
const rungOf = score => FAM[gradeOf(score).replace(/[+-]$/, "")];

/* ---------- data prep ---------- */
function prep(d, eps){
  D = d; Y0 = +D.start.slice(0,4); M0 = +D.start.slice(5,7)-1; CUT = ix(D.cut || "2026-10");
  const base = {};
  // estimated months (annual data stretched to monthly, or irregular sources): guessable, never an answer
  for(const [k, rs] of Object.entries(D.est || {})){ const m = new Uint8Array(D.series[k].length); for(const [p, q] of rs) m.fill(1, p, q+1); EST[k] = m }
  for(const k of Object.keys(C)){const a = D.series[k]; if(!a) continue; const v = [], bv = new Set(); let n = 0;
    const cut = Math.min(a.length-1, CUT), flat = [0], es = [0], em = EST[k];
    for(let i=1;i<=a.length;i++) es.push(es[i-1] + (em && em[i-1] ? 1 : 0));
    for(let i=1;i<a.length;i++) flat.push(flat[i-1] + (a[i]!=null && a[i-1]!=null && a[i]===a[i-1] ? 1 : 0));
    for(let i=0;i<=cut;i++){if(a[i]!=null)n++; if(i>=W && a[i-W]!=null)n--;
      if(i>=W-1 && n>=W-6 && a[i-W+1]!=null && a[i]!=null && es[i+1]-es[i-W+1] === 0){bv.add(i-W+1); if(flat[i]-flat[i-W+1] <= W*.2) v.push(i-W+1)}}
    base[k] = bv;
    if(v.length){valid[k] = v; validSet[k] = new Set(v); keys.push(k)}}
  // hand-picked episodes only need complete data, not the flat-stretch screen
  EPS = eps.map((e,i)=>({...e, i, si: ix(e.s), evi: e.ev ? ix(e.ev) : null})).filter(e => base[e.c] && base[e.c].has(e.si));
}
const isEst = (k, i) => !!(EST[k] && EST[k][i]);
const estFor = (rd, k, i) => isEst(k, i) || (rd.t === "spread" && isEst("DE", i));
const spreadCache = {};
function spreadOf(k){ if(spreadCache[k]) return spreadCache[k]; const a = D.series[k] || [], de = D.series.DE;
  return spreadCache[k] = a.map((v,i)=> v!=null && de[i]!=null ? +(v-de[i]).toFixed(3) : null) }
function seriesFor(rd, k){ return rd.t === "spread" ? spreadOf(k) : (D.series[k] || []) }
function rangeOf(arr, s){ let lo=1e9, hi=-1e9; for(let i=s;i<s+W;i++){const v=arr[i]; if(v!=null){lo=Math.min(lo,v); hi=Math.max(hi,v)}} return hi-lo }
function peakOf(arr, s){ let pk=s; for(let i=s;i<s+W;i++) if(arr[i]!=null && (arr[pk]==null || arr[i]>arr[pk])) pk=i; return pk }
function troughOf(arr, s){ let tr=s; for(let i=s;i<s+W;i++) if(arr[i]!=null && (arr[tr]==null || arr[i]<arr[tr])) tr=i; return tr }
function median(xs){ const a=[...xs].sort((p,q)=>p-q); return a[Math.floor(a.length/2)] }

/* ---------- session plans ---------- */
// Variety rules: a country that was an answer can come back 3 days later (Monday, then Thursday); a new window
// of the same country must start at least 3 years away from its windows of the last 30 days; no window with a
// near-identical twin; a headline episode not reused within 30 days. Rules relax one by one only if nothing fits.
const COOL = 3, OVERLAP = 36, HIST = 30, EP_GAP = 30;
const lookCache = {};
function lookalike(k, s){ const key = k+":"+s; if(key in lookCache) return lookCache[key];
  const a = D.series[k]; let res = false;
  for(const j of keys){ if(j === k) continue; const b = D.series[j], x = [], y = [];
    for(let i=s;i<s+W;i++) if(a[i]!=null && b[i]!=null && !isEst(j, i)){x.push(a[i]); y.push(b[i])}
    if(x.length < W*.9) continue;
    let ad = 0; x.forEach((v,i)=>ad += Math.abs(v-y[i])); if(ad/x.length >= .15) continue;
    const mx = x.reduce((p,c)=>p+c)/x.length, my = y.reduce((p,c)=>p+c)/y.length; let sxy=0, sxx=0, syy=0;
    x.forEach((v,i)=>{sxy+=(v-mx)*(y[i]-my); sxx+=(v-mx)**2; syy+=(y[i]-my)**2});
    if(sxx && syy && sxy/Math.sqrt(sxx*syy) >= .98){ res = true; break } }
  return lookCache[key] = res }
// rules for one plan: ctx = {cool:Set of countries, wins:{country:[starts]}, eps:Set of episode ids}
function clash(ctx, k, s){ return (ctx.wins[k] || []).some(t => Math.abs(t-s) < OVERLAP) }
function pickWin(r, codes, lo, hi, ok, ctx, level){
  // level 0: every rule; 1: windows may overlap; 2: cooldown dropped too
  for(let lv = level ?? 0; lv <= 2; lv++){
    const pool = codes.filter(k=>valid[k] && (lv >= 2 || !ctx.cool.has(k)));
    for(let tries=0; tries<80 && pool.length; tries++){
      const k = pick(r, pool), ss = valid[k], s = ss[Math.floor(r()*ss.length)];
      if(s < lo || s > hi || !ok(k, s) || (lv < 1 && clash(ctx, k, s)) || lookalike(k, s)) continue;
      return {c:k, s} }
    // rejection sampling missed: scan everything at this level
    const cand = pool.map(k=>[k, valid[k].filter(s=>s>=lo && s<=hi && ok(k,s) && (lv >= 1 || !clash(ctx, k, s)))]).filter(x=>x[1].length);
    if(cand.length){ const [c, ss] = pick(r, cand); return {c, s: pick(r, ss)} }
  }
  return null;
}
function genCountry(r, used, level, ctx){
  let codes, lo = 0, hi = CUT;
  if(level === "easy"){codes = EASY; lo = ix("1990-01")}
  else if(level === "medium") codes = MED;
  else if(r() < .5) codes = HARD; else {codes = [...EASY, ...MED]; hi = ix("1982-01")}
  const free = codes.filter(k=>!used.has(k));
  const w = pickWin(r, free, lo, hi, (k,s)=>rangeOf(D.series[k], s) >= 1.2, ctx) || pickWin(r, keys.filter(k=>!used.has(k)), 0, CUT, ()=>true, ctx);
  used.add(w.c); return {t:"country", k:level, c:w.c, s:w.s};
}
function epOk(ctx, e, strict){ return !ctx.eps.has(e.i) && (!strict || (!ctx.cool.has(e.c) && !clash(ctx, e.c, e.si))) }
function genTwist(r, used, type, ctx){
  if(type === "spread"){
    const codes = [...EASY, ...MED, ...HARD].filter(k=>k!=="DE" && !used.has(k));
    const w = pickWin(r, codes, 0, CUT, (k,s)=>validSet.DE.has(s) && rangeOf(spreadOf(k), s) >= 1, ctx);
    if(w){used.add(w.c); return {t:"spread", k:"spread", c:w.c, s:w.s}}
  }
  if(type === "year"){
    const roll = r();
    if(roll < .4){ const evs = EPS.filter(e=>e.evi!=null && !used.has(e.c) && epOk(ctx, e, true));
      if(evs.length){ const e = pick(r, evs); used.add(e.c); return {t:"year", k:"year", ym:"event", c:e.c, s:e.si, pk:e.evi, ep:e.i} } }
    const low = roll >= .7, codes = [...EASY, ...MED].filter(k=>!used.has(k));
    const ok = (k,s)=>{const a=D.series[k], p=low ? troughOf(a,s) : peakOf(a,s); if(p-s<6 || s+W-1-p<6) return false;
      const xs=[]; for(let i=s;i<s+W;i++) if(a[i]!=null) xs.push(a[i]); return low ? median(xs)-a[p] >= 1 : a[p]-median(xs) >= 1.5};
    const w = pickWin(r, codes, 0, CUT, ok, ctx);
    if(w){used.add(w.c); const a = D.series[w.c]; return {t:"year", k:"year", ym: low ? "low" : "peak", c:w.c, s:w.s, pk: low ? troughOf(a, w.s) : peakOf(a, w.s)}}
  }
  // higher or lower: three months, two countries each, close enough to need thought
  const lo = ix("1985-01"), span = CUT-lo, qs = [];
  for(let q=0;q<3;q++){
    let got = null;
    for(let tries=0; tries<300 && !got; tries++){
      const m = lo + Math.floor((q + r())/3*span);
      const pool = (r() < .75 ? [...EASY, ...MED] : keys).filter(k=>D.series[k] && D.series[k][m]!=null && !isEst(k, m));
      if(pool.length < 2) continue;
      const a = pick(r, pool); let b = pick(r, pool); if(a===b) continue;
      const d = Math.abs(D.series[a][m]-D.series[b][m]);
      if(d >= .05 && d <= (tries<200 ? .4 : 1.2)) got = {m, a, b};
    }
    if(got) qs.push(got);
  }
  return {t:"hl", k:"hl", qs};
}
function buildPlan(seed, n, ctx){
  const r = rngOf(hash(seed)), used = new Set(), rounds = [];
  // year-only episodes (yo) are dated events for guess-the-year rounds, not headline charts
  const heads = EPS.filter(e=>!e.yo);
  let eps = heads.filter(e=>epOk(ctx, e, true));
  if(!eps.length) eps = heads.filter(e=>epOk(ctx, e, false));
  if(!eps.length) eps = heads;
  const ep = pick(r, eps);
  // the order: a headline, an easy or medium country, two guess-the-year rounds, then higher or lower.
  // Unlimited sessions (n null) swap the second year round for the spread round half the time.
  rounds.push({t:"country", k:"headline", c:ep.c, s:ep.si, ep:ep.i}); used.add(ep.c);
  rounds.push(genCountry(r, used, r() < .5 ? "easy" : "medium", ctx));
  rounds.push(genTwist(r, used, "year", ctx));
  rounds.push(genTwist(r, used, !n && r() < .5 ? "spread" : "year", ctx));
  rounds.push(genTwist(r, used, "hl", ctx));
  return rounds;
}
// daily plans are built in order from day 1, so each day knows what came before
const PLANS = [];
function ctxOf(entries, coolFrom){ const ctx = {cool:new Set(), wins:{}, eps:new Set()};
  for(const h of entries){ (ctx.wins[h.c] ||= []).push(h.s); if(h.d >= coolFrom) ctx.cool.add(h.c); if(h.ep != null && h.epd) ctx.eps.add(h.ep) }
  return ctx }
function answersOf(rounds, d){ return rounds.filter(x=>x.c).map(x=>({c:x.c, s:x.s, d, ep:x.ep, epd:true})) }
function dailyPlan(n){
  n = Math.max(1, n);
  for(let d=1; d<=n; d++){ if(PLANS[d]) continue;
    if(FROZEN[d]){ PLANS[d] = decodePlan(FROZEN[d]); continue }
    const ent = []; for(let e=Math.max(1, d-HIST); e<d; e++) for(const h of answersOf(PLANS[e], e)) ent.push({...h, epd: h.ep != null && e >= d-EP_GAP});
    PLANS[d] = buildPlan("spreadle-day-"+d, d, ctxOf(ent, d-COOL+1)) }
  return PLANS[n];
}
const epOf = rd => EPS.find(e=>e.i===rd.ep);

/* ---------- frozen schedule ----------
   puzzles.json stores each published day with months as "YYYY-MM" and episodes by "country|start", so
   later data or code changes never alter a day that has been published. */
const ymOf = i => `${yearOf(i)}-${String((M0+i)%12+1).padStart(2,"0")}`;
const epKey = e => e.c+"|"+e.s;
function encodePlan(rounds){ return rounds.map(r=>{ const o = {t:r.t, k:r.k};
  if(r.c) o.c = r.c; if(r.s != null) o.s = ymOf(r.s); if(r.pk != null) o.pk = ymOf(r.pk); if(r.ym) o.ym = r.ym;
  if(r.ep != null){ const e = EPS.find(x=>x.i===r.ep); if(e) o.ep = epKey(e) }
  if(r.qs) o.qs = r.qs.map(q=>({m:ymOf(q.m), a:q.a, b:q.b}));
  return o }) }
function decodePlan(rounds){ return rounds.map(o=>{ const r = {t:o.t, k:o.k};
  if(o.c) r.c = o.c; if(o.s) r.s = ix(o.s); if(o.pk) r.pk = ix(o.pk); if(o.ym) r.ym = o.ym;
  if(o.ep){ const e = EPS.find(x=>epKey(x)===o.ep); if(e) r.ep = e.i }
  if(o.qs) r.qs = o.qs.map(q=>({m:ix(q.m), a:q.a, b:q.b}));
  return r }) }
let FROZEN = {};
function setFrozen(days){ FROZEN = days || {}; PLANS.length = 0 }
