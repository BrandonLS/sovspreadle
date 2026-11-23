"""Download every monthly source listed in data/sources.json into data/raw/<name>.json.

Each raw file maps a country code to {"start": "YYYY-MM", "v": [monthly values or null]}.
A download only replaces the existing raw file if it looks sound: every country present, and at least
95% as many observations as before. Otherwise the old file is kept and a warning is printed, so a broken
or changed source never wipes data. The annual JST file is static and not downloaded.

Usage: python3 scripts/fetch_data.py [--only NAME] [--dry-run]
"""
import csv, io, json, os, sys, time, urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
UA = "sovspreadle-data-update/1.0 (monthly refresh of public bond-yield statistics)"


def get(url, tries=3):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8-sig")
        except Exception as e:  # network hiccups: wait and retry
            if k == tries - 1:
                raise
            time.sleep(5 * (k + 1))


def to_series(by_month):
    """{"YYYY-MM": value} -> {"start", "v"} with null for missing months; None if empty."""
    if not by_month:
        return None
    ks = sorted(by_month)
    y, m = int(ks[0][:4]), int(ks[0][5:7])
    ey, em = int(ks[-1][:4]), int(ks[-1][5:7])
    v = []
    while (y, m) <= (ey, em):
        v.append(by_month.get(f"{y}-{m:02d}"))
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return {"start": ks[0], "v": v}


def num(x):
    try:
        return round(float(x), 2)
    except (TypeError, ValueError):
        return None


# ---- parsers (kept separate from downloads so they can be tested on saved responses) ----
def parse_fred(text):
    """FRED fredgraph.csv: observation_date,<ID> rows; '.' or empty means missing."""
    out = {}
    for row in list(csv.reader(io.StringIO(text)))[1:]:
        if len(row) >= 2 and num(row[1]) is not None:
            out[row[0][:7]] = num(row[1])
    return out


def parse_ecb(text):
    """ECB data API csvdata: KEY,...,TIME_PERIOD,OBS_VALUE. Several series may match the key; per month the
    series with the most observations wins."""
    rows = list(csv.DictReader(io.StringIO(text)))
    by_key = {}
    for r in rows:
        v = num(r.get("OBS_VALUE"))
        if v is not None:
            by_key.setdefault(r["KEY"], {})[r["TIME_PERIOD"][:7]] = v
    out = {}
    for key in sorted(by_key, key=lambda k: -len(by_key[k])):
        for m, v in by_key[key].items():
            out.setdefault(m, v)
    return out


def parse_dbnomics(text):
    """DBnomics series JSON: series.docs[0].period / .value, 'NA' for missing."""
    doc = json.loads(text)["series"]["docs"][0]
    return {p[:7]: num(v) for p, v in zip(doc["period"], doc["value"]) if v not in ("NA", None) and num(v) is not None}


def parse_mof(text):
    """Japan MoF jgbcme_all.csv: two header lines, then Date,1Y,...,10Y,...; monthly average of the 10-year
    yield, or the 9-year where the 10-year is missing (before mid-1986)."""
    acc = {}
    for row in list(csv.reader(io.StringIO(text)))[2:]:
        if len(row) < 11 or "/" not in row[0]:
            continue
        y, m = row[0].split("/")[:2]
        v = num(row[10])
        if v is None:
            v = num(row[9])
        if v is not None:
            acc.setdefault(f"{y}-{int(m):02d}", []).append(v)
    return {k: round(sum(x) / len(x), 2) for k, x in acc.items()}


def parse_riksbank(text):
    """Riksbank SWEA observations: [{"date": "YYYY-MM-DD", "value": n}], daily; monthly average."""
    acc = {}
    for o in json.loads(text):
        if o.get("value") is not None:
            acc.setdefault(o["date"][:7], []).append(float(o["value"]))
    return {k: round(sum(x) / len(x), 2) for k, x in acc.items()}


# ---- downloads ----
def fetch(src):
    kind, out = src["kind"], {}
    if kind == "fred":
        for cc, sid in src["series"].items():
            out[cc] = parse_fred(get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}"))
            time.sleep(1)
    elif kind == "ecb":
        for cc in src["countries"]:
            out[cc] = parse_ecb(get(f"https://data-api.ecb.europa.eu/service/data/IRS/M.{cc}.L.L40.CI.0000..N.Z?format=csvdata&detail=dataonly"))
    elif kind == "dbnomics_ifs":
        for cc in src["countries"]:
            out[cc] = parse_dbnomics(get(f"https://api.db.nomics.world/v22/series/IMF/IFS/M.{cc}.FIGB_PA?observations=1"))
    elif kind == "mof_jp":
        out["JP"] = parse_mof(get("https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/historical/jgbcme_all.csv"))
    elif kind == "riksbank":
        for cc, sid in src["series"].items():
            out[cc] = parse_riksbank(get(f"https://api.riksbank.se/swea/v1/Observations/{sid}/1980-01-01/{date.today()}"))
    else:
        raise ValueError(f"unknown source kind {kind}")
    return {cc: to_series(m) for cc, m in out.items()}


def count(raw):
    return {cc: sum(x is not None for x in s["v"]) for cc, s in raw.items() if s}


def main():
    args = sys.argv[1:]
    only = args[args.index("--only") + 1] if "--only" in args else None
    dry = "--dry-run" in args
    cfg = json.load(open(os.path.join(ROOT, "data", "sources.json")))
    problems = 0
    for src in cfg["sources"]:
        if only and src["name"] != only:
            continue
        path = os.path.join(RAW, src["name"] + ".json")
        old = json.load(open(path)) if os.path.exists(path) else {}
        try:
            new = fetch(src)
        except Exception as e:
            print(f"WARNING {src['name']}: download failed ({e}); keeping the old file")
            problems += 1
            continue
        oc, nc = count(old), count(new)
        bad = [cc for cc in oc if nc.get(cc, 0) < 0.95 * oc[cc]]
        if bad:
            print(f"WARNING {src['name']}: fewer observations than before for {', '.join(bad)}; keeping the old file")
            problems += 1
            continue
        gained = sum(nc.values()) - sum(oc.values())
        print(f"{src['name']}: {len(nc)} countries, {sum(nc.values())} observations ({gained:+d})")
        if not dry:
            with open(path, "w") as f:
                json.dump({cc: s for cc, s in new.items() if s}, f, separators=(",", ":"))
    if problems:
        print(f"{problems} source(s) kept their previous data; check the warnings above.")


if __name__ == "__main__":
    main()
