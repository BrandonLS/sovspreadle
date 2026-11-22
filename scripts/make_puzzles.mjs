// Builds or extends public/puzzles.json, the frozen daily schedule.
// Days already in the file are never changed; new days are generated after them with the same rules the
// game uses (core.js), so a day's puzzle stays the same once published.
// Usage: node scripts/make_puzzles.mjs [--ahead 400]   (days to cover beyond today)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = f => path.join(root, "public", f);
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? Number(process.argv[i + 1]) : dflt; };
const ahead = arg("--ahead", 400);

const ctx = vm.createContext({ console });
const api = vm.runInContext(fs.readFileSync(pub("core.js"), "utf8") +
  "\n;({prep, dailyPlan, encodePlan, setFrozen, EPOCH})", ctx);

const data = JSON.parse(fs.readFileSync(pub("data.json"), "utf8"));
const episodes = JSON.parse(fs.readFileSync(pub("episodes.json"), "utf8"));
api.prep(data, episodes);

const file = pub("puzzles.json");
const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { days: {} };
api.setFrozen(old.days);

const now = new Date();
const today = Math.max(1, Math.round((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - api.EPOCH) / 864e5) + 1);
const last = today + ahead;
api.dailyPlan(last);

const days = { ...old.days };
let added = 0;
for (let d = 1; d <= last; d++) if (!days[d]) { days[d] = api.encodePlan(api.dailyPlan(d)); added++; }
const epoch = new Date(api.EPOCH).toISOString().slice(0, 10);
fs.writeFileSync(file, JSON.stringify({ version: 1, epoch, through: last, days }));
console.log(`puzzles.json: days 1 to ${last} (today is day ${today}), ${added} new`);
