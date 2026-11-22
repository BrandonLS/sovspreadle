// Sanity check before publishing: data loads, and every day in puzzles.json still decodes to playable rounds.
// Exits with an error (so the monthly job stops before committing) if anything is off.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => JSON.parse(fs.readFileSync(path.join(root, "public", f), "utf8"));
const ctx = vm.createContext({ console });
const api = vm.runInContext(fs.readFileSync(path.join(root, "public", "core.js"), "utf8") +
  "\n;({prep, decodePlan, keys: () => keys, W})", ctx);
const data = read("data.json");
api.prep(data, read("episodes.json"));
read("notes.json");
const pz = read("puzzles.json");
const errors = [];
const obs = (k, s) => { const a = data.series[k] || []; let n = 0; for (let i = s; i < s + api.W; i++) if (a[i] != null) n++; return n; };
for (const [d, enc] of Object.entries(pz.days)) {
  const plan = api.decodePlan(enc);
  if (plan.length !== 5) errors.push(`day ${d}: ${plan.length} rounds`);
  plan.forEach((r, i) => {
    const where = `day ${d} bond ${i + 1}`;
    if (r.t === "hl") {
      if (!r.qs || r.qs.length !== 3) errors.push(`${where}: higher or lower has ${r.qs?.length} questions`);
      for (const q of r.qs || []) if (data.series[q.a]?.[q.m] == null || data.series[q.b]?.[q.m] == null) errors.push(`${where}: missing value for ${q.a}/${q.b}`);
      return;
    }
    if (!data.series[r.c]) errors.push(`${where}: unknown country ${r.c}`);
    else if (obs(r.c, r.s) < 100) errors.push(`${where}: ${r.c} window has only ${obs(r.c, r.s)} months of data`);
    if (r.k === "headline" && r.ep == null) errors.push(`${where}: headline episode not found`);
  });
}
const days = Object.keys(pz.days).length;
if (errors.length) { console.error(errors.slice(0, 20).join("\n")); console.error(`${errors.length} problem(s)`); process.exit(1); }
console.log(`check passed: ${Object.keys(data.series).length} countries, ${days} puzzle days, all playable`);
