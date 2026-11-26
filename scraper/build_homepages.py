"""Looks up each ABDC journal's homepage by ISSN using the OpenAlex index (free, no key).
Results are cached in scraper/homepages.json, so later runs only fetch journals still missing.
Writes site/data/homepages.js as window.HOMEPAGES = { "<journal id>": "<url>" }.

Run:  python scraper/build_homepages.py            (add --refresh to look everything up again)
"""
import json, re, sys, time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scraper" / "homepages.json"
OUT = ROOT / "site" / "data" / "homepages.js"
UA = "CFPFinderBot/1.0 (academic journal call-for-papers aggregator)"
ISSN = re.compile(r"^\d{4}-\d{3}[\dXx]$")


def load_journals():
    js = (ROOT / "site" / "data" / "journals.js").read_text(encoding="utf-8-sig")
    return json.loads(js[js.index("=") + 1:].rstrip(";\n "))


def issns(j):
    return [s.upper() for s in (j["issn"], j["eissn"]) if ISSN.match(s or "")]


def main():
    journals = load_journals()
    cache = {} if "--refresh" in sys.argv or not CACHE.exists() else json.loads(CACHE.read_text(encoding="utf-8-sig"))
    todo = [j for j in journals if not cache.get(str(j["id"])) and issns(j)]
    by_issn = {}
    for j in todo:
        for s in issns(j): by_issn.setdefault(s, []).append(j["id"])
    keys = list(by_issn)
    s = requests.Session(); s.headers["User-Agent"] = UA
    found = 0
    for i in range(0, len(keys), 50):
        chunk = keys[i:i + 50]
        for attempt in range(3):
            try:
                r = s.get("https://api.openalex.org/sources", timeout=40, params={
                    "filter": "issn:" + "|".join(chunk), "select": "issn,homepage_url", "per-page": 100})
                r.raise_for_status(); break
            except Exception as e:
                if attempt == 2: print("FAIL chunk", i, e); r = None
                time.sleep(2 * (attempt + 1))
        if r is None: continue
        for src in r.json().get("results", []):
            url = (src.get("homepage_url") or "").strip()
            if not url.startswith("http"): continue
            for issn in src.get("issn") or []:
                for jid in by_issn.get(issn.upper(), []):
                    if not cache.get(str(jid)): cache[str(jid)] = url; found += 1
        time.sleep(0.3)
    CACHE.write_text(json.dumps(cache, indent=0), encoding="utf-8")
    OUT.write_text("window.HOMEPAGES=" + json.dumps(cache, separators=(",", ":")) + ";", encoding="utf-8")
    have = sum(1 for j in journals if cache.get(str(j["id"])))
    print(f"{have} of {len(journals)} journals have a homepage ({found} new this run)")


if __name__ == "__main__":
    main()
