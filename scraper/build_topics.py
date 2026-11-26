"""Looks up what each ABDC journal publishes about, using OpenAlex's topic data (free, no key, no AI).
OpenAlex counts the topics of the articles each journal has published. The site's "Match my research"
box scores your keywords against these topics.

Results are cached in scraper/topics.json. Writes site/data/topics.js as
  window.TOPICS = { names: [...], j: { "<journal id>": [nameIndex, weight, nameIndex, weight, ...] } }
where weight is the topic's share of the journal's output, in parts per thousand.

Run:  python scraper/build_topics.py            (add --refresh to look everything up again)
"""
import json, re, sys, time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scraper" / "topics.json"
OUT = ROOT / "site" / "data" / "topics.js"
UA = "CFPFinderBot/1.0 (academic journal call-for-papers aggregator)"
ISSN = re.compile(r"^\d{4}-\d{3}[\dXx]$")
TOP_TOPICS, TOP_SUBFIELDS = 14, 4


def load_journals():
    js = (ROOT / "site" / "data" / "journals.js").read_text(encoding="utf-8-sig")
    return json.loads(js[js.index("=") + 1:].rstrip(";\n "))


def issns(j):
    return [s.upper() for s in (j["issn"], j["eissn"]) if ISSN.match(s or "")]


def summarise(src):
    """[[name, share per thousand], ...]: the journal's top topics plus its main subfields."""
    topics = src.get("topics") or []
    total = sum(t.get("count", 0) for t in topics) or 1
    out = [[t["display_name"], round(1000 * t["count"] / total)] for t in topics[:TOP_TOPICS]]
    sub = {}
    for t in topics:
        name = (t.get("subfield") or {}).get("display_name")
        if name: sub[name] = sub.get(name, 0) + t.get("count", 0)
    out += [[n, round(1000 * c / total)] for n, c in sorted(sub.items(), key=lambda x: -x[1])[:TOP_SUBFIELDS]]
    return [o for o in out if o[1] > 0]


def main():
    journals = load_journals()
    cache = {} if "--refresh" in sys.argv or not CACHE.exists() else json.loads(CACHE.read_text(encoding="utf-8-sig"))
    by_issn = {}
    for j in journals:
        if str(j["id"]) not in cache:
            for s in issns(j): by_issn.setdefault(s, []).append(j["id"])
    keys = list(by_issn)
    s = requests.Session(); s.headers["User-Agent"] = UA
    for i in range(0, len(keys), 50):
        chunk, r = keys[i:i + 50], None
        for attempt in range(3):
            try:
                r = s.get("https://api.openalex.org/sources", timeout=40, params={
                    "filter": "issn:" + "|".join(chunk), "select": "issn,topics", "per-page": 100})
                r.raise_for_status(); break
            except Exception as e:
                r = None
                if attempt == 2: print("FAIL chunk", i, e)
                time.sleep(2 * (attempt + 1))
        if r is None: continue
        for src in r.json().get("results", []):
            summary = summarise(src)
            if not summary: continue
            for issn in src.get("issn") or []:
                for jid in by_issn.get(issn.upper(), []): cache.setdefault(str(jid), summary)
        time.sleep(0.3)
    CACHE.write_text(json.dumps(cache, separators=(",", ":")), encoding="utf-8")

    names, idx, packed = [], {}, {}
    for jid, items in cache.items():
        row = []
        for name, w in items:
            if name not in idx: idx[name] = len(names); names.append(name)
            row += [idx[name], w]
        packed[jid] = row
    OUT.write_text("window.TOPICS=" + json.dumps({"names": names, "j": packed}, separators=(",", ":"), ensure_ascii=False) + ";", encoding="utf-8")
    print(f"{len(packed)} of {len(journals)} journals have topic data ({len(names)} distinct topics)")


if __name__ == "__main__":
    main()
