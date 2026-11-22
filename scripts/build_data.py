"""Build public/data.json from the raw downloads in data/raw, following data/sources.json.

Order (each step only touches months the earlier steps left empty):
  1. base series (OECD long-term rates via FRED), short gaps of up to 3 months interpolated
  2. 'new' sources add countries the base lacks (ECB, IMF, more OECD series)
  3. 'fill' sources extend countries further back (older IMF, FRED, Japan MoF, Riksbank series)
  4. annual Jorda-Schularick-Taylor rates, interpolated monthly, fill what is still empty before the
     last real observation; these months are marked "estimated" (guess-only in the game)
  5. series listed under guess_only are marked estimated up to the given month
The game's puzzle windows stop at "cut", the last month at least 30 countries report; cut never moves back.
Usage: python3 scripts/build_data.py
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "public", "data.json")


def load(name):
    with open(os.path.join(RAW, name + ".json")) as f:
        return json.load(f)


def fill_gaps(v, maxgap=3):
    """Linearly interpolate internal runs of up to maxgap missing months."""
    idx = [j for j, x in enumerate(v) if x is not None]
    for a, b in zip(idx, idx[1:]):
        if 1 < b - a <= maxgap + 1:
            for k in range(a + 1, b):
                v[k] = round(v[a] + (v[b] - v[a]) * (k - a) / (b - a), 2)
    return v


def despike(v):
    """Replace single-month spikes (more than 3 points off two neighbours that agree)."""
    for i in range(1, len(v) - 1):
        a, b, c = v[i - 1], v[i], v[i + 1]
        if None not in (a, b, c) and abs(a - c) < 1.5 and abs(b - (a + c) / 2) > 3:
            v[i] = round((a + c) / 2, 2)
    return v


def months(ym):
    return int(ym[:4]) * 12 + int(ym[5:7]) - 1


def ym_of(m):
    return f"{m // 12}-{m % 12 + 1:02d}"


def main():
    cfg = json.load(open(os.path.join(ROOT, "data", "sources.json")))
    srcs = cfg["sources"]
    # 1. base: the global month range is the base series' first to last month
    base = load(srcs[0]["name"])
    m0 = min(months(s["start"]) for s in base.values())
    m1 = max(months(s["start"]) + len(s["v"]) - 1 for s in base.values())
    n = m1 - m0 + 1
    S = {}
    for k, s in base.items():
        arr = [None] * n
        for j, x in enumerate(s["v"]):
            if x is not None:
                arr[months(s["start"]) - m0 + j] = round(x, 2)
        S[k] = fill_gaps(arr)
    # 2. new countries
    for src in (x for x in srcs if x["role"] == "new"):
        for k, s in load(src["name"]).items():
            if k in S:
                continue
            arr = [None] * n
            i0 = months(s["start"]) - m0
            for j, x in enumerate(s["v"]):
                if 0 <= i0 + j < n:
                    arr[i0 + j] = x
            S[k] = fill_gaps(arr)
    # extend the range back to the configured start
    start = months(cfg["start"])
    shift = m0 - start
    S = {k: [None] * shift + v for k, v in S.items()}
    n += shift
    ix = lambda ym: months(ym) - start
    # 3. older history, only into empty months
    for src in (x for x in srcs if x["role"] == "fill"):
        until = src.get("until", {})
        for k, s in load(src["name"]).items():
            vals = list(s["v"])
            if k in until:
                vals = vals[: months(until[k]) - months(s["start"]) + 1]
            vals = despike(vals)
            i0 = ix(s["start"])
            for j, x in enumerate(vals):
                i = i0 + j
                if 0 <= i < n and S[k][i] is None and x is not None:
                    S[k][i] = x
            S[k] = fill_gaps(S[k])
    # 4. annual estimates
    J = load(cfg["annual"]["name"])
    EST = {}
    for k, yrs in J.items():
        a = S[k]
        last = max(i for i, x in enumerate(a) if x is not None)
        pts = sorted((ix(f"{y}-07"), v) for y, v in yrs.items())
        est, i = [], 0
        while i <= last:
            if a[i] is not None:
                i += 1
                continue
            j = i
            while a[j] is None:
                j += 1
            anchors = [p for p in pts if i <= p[0] < j] + [(j, a[j])]
            if i > 0 and a[i - 1] is not None:
                anchors = [(i - 1, a[i - 1])] + anchors
            if len(anchors) >= 2:
                first = anchors[0]
                for m in range(i, j):
                    if m < first[0]:
                        a[m] = first[1]
                    else:
                        p = max(x for x in anchors if x[0] <= m)
                        q = min(x for x in anchors if x[0] > m)
                        a[m] = round(p[1] + (q[1] - p[1]) * (m - p[0]) / (q[0] - p[0]), 2)
                est.append([i, j - 1])
            i = j
        if est:
            EST[k] = est
    # 5. guess-only stretches
    for k, until in cfg["guess_only"].items():
        first = next(i for i, x in enumerate(S[k]) if x is not None)
        last = max(i for i, x in enumerate(S[k]) if x is not None)
        EST.setdefault(k, []).append([first, min(ix(until) - 1, last)])
        EST[k].sort()
    # cut: last month with at least 30 countries reporting real data; never earlier than before
    real = lambda k, i: S[k][i] is not None and not any(p <= i <= q for p, q in EST.get(k, []))
    cut = max(i for i in range(n) if sum(real(k, i) for k in S) >= 30)
    old_cut = None
    if os.path.exists(OUT):
        old_cut = json.load(open(OUT)).get("cut")
    cut_ym = ym_of(start + cut)
    if old_cut and old_cut > cut_ym:
        cut_ym = old_cut
    out = {"start": cfg["start"], "cut": cut_ym, "series": S, "est": EST}
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"data.json: {len(S)} countries, {cfg['start']} to {ym_of(start + n - 1)}, puzzles use windows up to {cut_ym}")


if __name__ == "__main__":
    sys.exit(main())
