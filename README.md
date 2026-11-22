# Spreadle

A daily browser game: five 10-year government bond yield charts, five coupons each. Guess the country,
the year, or who paid more to borrow, and earn a credit rating from D to AAA.

The site is static: HTML, CSS, JavaScript and JSON files in `public/`, no server and no build step.
A monthly GitHub Action refreshes the data and extends the puzzle schedule.

## Put it online (about an hour)

1. **Create a GitHub repository** and push this folder to it:
   ```sh
   git remote add origin https://github.com/<you>/spreadle.git
   git push -u origin main
   ```
2. **Connect a free static host.** Cloudflare Pages is a good choice (fast, free, unlimited traffic):
   Workers & Pages → Create → Pages → Connect to Git → pick the repository, then set
   - Framework preset: None
   - Build command: *(leave empty)*
   - Build output directory: `public`

   Netlify ("Publish directory: public") or GitHub Pages (Settings → Pages, deploy from the `public` folder
   via an Action) work too. Every push goes live automatically.
3. **Buy a domain** (about 10 to 20 CHF a year) and add it as a custom domain in the host's settings.
4. **Point the share previews at it** (WhatsApp, X and others need full addresses), then commit and push:
   ```sh
   python3 scripts/set_domain.py https://your-domain
   ```
5. **Fill in the contact line** in `public/privacy.html` (search for `[your contact email]`).
6. **Allow the monthly job to commit:** in the GitHub repository, Settings → Actions → General →
   Workflow permissions → "Read and write permissions". Then run it once by hand: Actions →
   "Monthly data update" → Run workflow, and check the log.

## How it fits together

| Path | What it is |
| --- | --- |
| `public/index.html`, `style.css`, `fonts.css`, `fonts/` | The page, styles, and self-hosted fonts (no third-party requests) |
| `public/core.js` | Reference data, data prep and the puzzle generator; runs in the browser and in Node |
| `public/app.js` | The interface: rounds, hints, charts, sound, end screen |
| `public/data.json` | Monthly yields for 46 countries from 1950, built by `scripts/build_data.py` |
| `public/puzzles.json` | The frozen daily schedule. Published days never change |
| `public/episodes.json`, `notes.json` | Headline episodes and "Did you know?" notes, all fact-checked |
| `public/credits.html`, `privacy.html` | Data credits and licences; privacy notice |
| `data/sources.json` | Which series come from where, in priority order, and which stretches are guess-only |
| `data/raw/*.json` | The latest download of each source |
| `scripts/fetch_data.py` | Downloads every source (FRED, ECB, DBnomics, Japan MoF, Riksbank) |
| `scripts/build_data.py` | Merges the raw files into `public/data.json` |
| `scripts/make_puzzles.mjs` | Extends `puzzles.json`; never rewrites a published day |
| `scripts/check_site.mjs` | Checks every scheduled day is playable before anything is committed |
| `.github/workflows/update-data.yml` | Runs the four scripts on the 4th of each month and commits the result |

## The daily schedule

Day 1 is 22 November 2026, and each player's day follows their local date, like Wordle. The schedule in
`puzzles.json` is generated ahead of time (currently through day 731) with the same rules the game uses:

- a country that was an answer can come back three days later at the earliest;
- a new window for a country starts at least three years away from its windows of the last 30 days;
- no window where another country is a near-identical twin;
- a headline episode isn't reused within 30 days.

Because published days are stored, later changes to the code, rules or data never alter a puzzle someone
has already played. Changes only affect days that haven't been generated yet. To regenerate future days
after a rules change, delete the days you want rebuilt from `puzzles.json` (never past or current ones)
and run `node scripts/make_puzzles.mjs`.

Without `puzzles.json` (for example when testing a single file), the game computes the same puzzles live.

## Updating the data by hand

```sh
python3 scripts/fetch_data.py          # downloads; keeps the old file for any source that looks broken
python3 scripts/build_data.py          # rebuilds public/data.json
node scripts/make_puzzles.mjs --ahead 400
node scripts/check_site.mjs
```

The fetch script refuses to replace a source if the download fails or has fewer observations than before,
and says so in its output. Puzzles only use windows up to the `cut` month in `data.json`: the latest month
at least 30 countries report. It moves forward as data arrives, never back.

## Testing locally

```sh
cd public && python3 -m http.server 8000
```

Open http://localhost:8000. Add `?debug` to the address to expose `window.__sp` in the browser console
(the current plan, session and the puzzle generator).

## Licences

- **Code:** MIT (see `LICENSE`).
- **Data:** `public/data.json` includes material from the Jordà-Schularick-Taylor Macrohistory Database,
  licensed CC BY-NC-SA 4.0, so the combined file is shared under the same licence. That means the game
  must stay non-commercial (no ads or paid tiers) unless those estimates are removed. IMF data also allows
  only non-commercial reuse without permission. Full credits are in `public/credits.html`.
- **Fonts:** Cinzel and Public Sans, SIL Open Font License (`public/fonts/OFL-*.txt`).
