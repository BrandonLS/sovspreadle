# SovSpreadle

A daily guessing game about government bond yields. Every day you get five charts of a country's 10-year
government bond yield. Name the country, spend as few coupons as you can, and earn a credit rating from D to AAA.

## How to play

- **Five bonds a day**, the same for everyone. A new set starts at midnight, your local time.
- **Each bond is a 10-year window** of monthly yields. Type a country to guess.
- **You have five coupons per bond.** Every guess and every hint uses one.
- **Wrong guesses still help.** Your guess is drawn as a dashed line on the chart, with how far it was from the
  answer in basis points and how similar its shape was.
- **Hints:** the region, the country that moved most like the answer, or five more years on each side of the window.
- **Bond 1 is a headline:** a famous moment in bond-market history.
- **Bond 4 is a twist** that rotates daily: the spread over Germany, higher or lower, or guess the year of a peak,
  a low or a famous event.
- **Scoring:** 4 points for the first coupon, 3 for the second, 2 for the third, 1 after that, 0 for a miss.
  Your total out of 20 sets your rating, one notch per point. Only a perfect 20 is AAA, and BBB- (11 points)
  is investment grade.
- **After each bond** you see the full history of that country's yield and, often, a short story about what
  happened in those years.
- **Play unlimited** for extra rounds that don't count toward your streak.

When you finish, share your result: a grid of colored squares that doesn't give the answers away.

## The data

Monthly averages of long-term government bond yields for 46 countries, from 1950 to today:

- OECD long-term interest rates (via FRED)
- the European Central Bank
- the IMF (via DBnomics)
- Japan's Ministry of Finance
- Sveriges Riksbank

Early years for some countries are estimates built from annual figures in the Jordà-Schularick-Taylor
Macrohistory Database. Those stretches, and a few series that aren't true 10-year benchmarks, are drawn dotted:
you can guess them, but they are never the answer. Full credits and licenses are in
[`public/credits.html`](public/credits.html).

The data is refreshed automatically each month. Published puzzles never change: the daily schedule is stored
in advance, so a new month of data or a change to the rules only affects days that haven't been played yet.

## Privacy

No accounts, cookies, ads or tracking. Your progress and stats are saved only in your own browser.
See [`public/privacy.html`](public/privacy.html).

## Under the hood

The game is a static site with no dependencies: HTML, CSS, JavaScript and JSON in `public/`.

| Path | What it is |
| --- | --- |
| `public/core.js` | Reference data, data preparation and the puzzle generator; runs in the browser and in Node |
| `public/app.js` | The interface: rounds, hints, charts, sound, end screen |
| `public/data.json` | Monthly yields for every country, built from the raw downloads |
| `public/puzzles.json` | The daily schedule, generated ahead of time |
| `public/episodes.json`, `notes.json` | Headline episodes and history notes |
| `data/sources.json` | Which series come from where, in priority order |
| `scripts/` | Download the sources, build the data file, extend the schedule, check everything is playable |
| `.github/workflows/update-data.yml` | The monthly update |

### Run it locally

```sh
cd public && python3 -m http.server 8000
```

Then open http://localhost:8000. Add `?debug` to the address to inspect the current puzzle in the browser console.

### Update the data by hand

```sh
python3 scripts/fetch_data.py
python3 scripts/build_data.py
node scripts/make_puzzles.mjs --ahead 400
node scripts/check_site.mjs
```

The download step keeps the previous data for any source that fails or returns less than before.

## Corrections

Spotted a wrong fact or a strange number? Please open an issue with the country and the month.

## License

- **Code:** MIT, see [`LICENSE`](LICENSE).
- **Data:** the combined data file includes material licensed CC BY-NC-SA 4.0, so it is shared under the same
  license and the game is non-commercial. See [`public/credits.html`](public/credits.html).
- **Fonts:** Cinzel and Public Sans, SIL Open Font License.
