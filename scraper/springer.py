"""Springer Nature collector: matches ABDC journals to Springer journal IDs (via Springer's
public A-Z index, cached in springer_ids.json) and reads each journal's open
'Collections and calls for papers' page, which lists a structured submission deadline."""
import json, re, string
from pathlib import Path
from bs4 import BeautifulSoup
import datetime as dt

HERE = Path(__file__).resolve().parent
CACHE = HERE / "springer_ids.json"
PUB = re.compile(r"springer|palgrave", re.I)      # Kluwer Law / Wolters Kluwer are not on Springer Link
key = lambda t: re.sub(r"[^a-z0-9]+", " ", t.lower().replace("&", " and ")).strip()


def variants(title):
    """Keys a title may be known by: full, without subtitle after ':' or ' - ', without '(…)', without leading 'The'."""
    t = re.sub(r"\s+", " ", title).strip()
    outs = {t, re.sub(r"\([^)]*\)", "", t), re.split(r"\s*:\s*|\s+[-–—]\s+", t)[0]}
    outs |= {re.sub(r"^the\s+", "", o, flags=re.I) for o in list(outs)}
    return [k for k in {key(o) for o in outs} if k]


def build_index(fetch):
    """Return {normalised title: journal id} from link.springer.com/journals/<letter>/<page>."""
    idx = {}
    for letter in ["1"] + list(string.ascii_lowercase):      # "1" = titles starting with a digit
        page = 1
        while True:
            try: html = fetch(f"https://link.springer.com/journals/{letter}/{page}")
            except Exception as e:
                if not idx: print(f"Springer A-Z index: {e}")
                break
            soup = BeautifulSoup(html, "html.parser")
            found = 0
            for a in soup.find_all("a", href=re.compile(r"/journal/\d+$")):
                t = a.get_text(" ", strip=True)
                if t:
                    for k in variants(t): idx.setdefault(k, int(a["href"].split("/")[-1]))
                    found += 1
            if not found: break
            page += 1
    return idx


def resolve_ids(journals, fetch, refresh=False):
    ids = {} if refresh or not CACHE.exists() else json.loads(CACHE.read_text(encoding="utf-8"))
    todo = [j for j in journals if PUB.search(j["publisher"]) and not ids.get(str(j["id"]))]
    if todo:
        idx = build_index(fetch)
        if len(idx) < 1000:      # a partial index would wrongly cache "no match": keep the cache as it is
            print(f"Springer A-Z index incomplete ({len(idx)} titles); using the saved ID list instead")
            return ids
        for j in todo:
            # try our title's variants against the index; the first hit wins (full title is tried first)
            ids[str(j["id"])] = next((idx[k] for k in [key(j["title"])] + variants(j["title"]) if k in idx), None)
        CACHE.write_text(json.dumps(ids, indent=0), encoding="utf-8")
    return ids


def parse_collections(html, base="https://link.springer.com"):
    out = []
    for card in BeautifulSoup(html, "html.parser").select("article.app-card-collection"):
        a = card.select_one("a.app-card-collection__heading-link")
        if not a: continue
        meta = {dt_.get_text(strip=True).lower(): dt_.find_next("dd").get_text(strip=True)
                for dt_ in card.select("dl.app-card-collection__description-list dt")}
        if meta.get("submission status", "").lower() not in ("open", "upcoming"): continue
        closes = None
        deadline = meta.get("submission deadline", "")
        ongoing = deadline.strip().lower() == "ongoing"
        m = re.match(r"(\d{1,2}) (\w+) (\d{4})", deadline)
        if m:
            try: closes = dt.datetime.strptime(" ".join(m.groups()), "%d %B %Y").date().isoformat()
            except ValueError: pass
        out.append({"title": a.get_text(" ", strip=True), "url": base + a["href"],
                    "opens": None, "closes": closes, "ongoing": ongoing})
    return out


def collect(journals, fetch, log, checked):
    """Yield (journal_id, call dict) for every open Springer call.
    Journals whose page was read successfully are added to `checked`."""
    ids = resolve_ids(journals, fetch)
    matched = {int(k): v for k, v in ids.items() if v}
    log(f"Springer: matched {len(matched)} of {len(ids)} Springer-published ABDC journals")
    for jid, sid in matched.items():
        try:
            calls = parse_collections(fetch(f"https://link.springer.com/journal/{sid}/collections?filter=Open"))
            checked.add(jid)
            for c in calls:
                yield jid, c
        except Exception as e:
            log(f"FAIL  Springer journal {sid}: {e}")
