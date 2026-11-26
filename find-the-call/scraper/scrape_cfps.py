"""Weekly call-for-papers collector.

Reads scraper/sources.json (journal -> CFP listing page) and scraper/manual_cfps.csv,
extracts calls, merges them with what is already stored, drops expired ones, and writes
site/data/cfps.js (+ cfps.json). No approval step: whatever it finds is published.

Run:  python scraper/scrape_cfps.py            (add --selftest to test the parser offline)
"""
import csv, json, re, sys, time, datetime as dt
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
DATA = ROOT / "site" / "data"
UA = "CFPFinderBot/1.0 (academic journal call-for-papers aggregator; respects robots.txt)"
TODAY = dt.date.today()
KEEP_EXPIRED_DAYS = 0          # drop a call the day after it closes
MAX_DETAIL_PAGES = 15          # per journal per run
DELAY = 2.0                    # seconds between requests

MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august",
     "september", "october", "november", "december"], 1)}
MONTHS.update({k[:3]: v for k, v in list(MONTHS.items())})
MONTHS["sept"] = 9
MON = r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
DATE_RES = [
    (re.compile(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+{MON}\.?,?\s+(\d{{4}})\b", re.I), "dmy"),
    (re.compile(rf"\b{MON}\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?,?\s+(\d{{4}})\b", re.I), "mdy"),
    (re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"), "iso"),
]
CLOSE_KW = re.compile(r"(deadline|submissions? (?:due|close|until|by)|due date|closing date|closes?|submit(?:ted)? by|until)", re.I)
OPEN_KW = re.compile(r"(opens?|opening date|submissions? open|open for submissions?|starts?|from)", re.I)
CFP_LINK = re.compile(r"call for papers|calls for papers|special issue|special section|cfp|call for submissions", re.I)


def find_dates(text):
    """Return [(position, date)] for every recognisable date in text."""
    found = []
    for rx, kind in DATE_RES:
        for m in rx.finditer(text):
            try:
                if kind == "dmy": d = dt.date(int(m[3]), MONTHS[m[2].lower()], int(m[1]))
                elif kind == "mdy": d = dt.date(int(m[3]), MONTHS[m[1].lower()], int(m[2]))
                else: d = dt.date(int(m[1]), int(m[2]), int(m[3]))
                found.append((m.start(), d))
            except (ValueError, KeyError):
                pass
    return sorted(found)


def extract_dates(text):
    """Pick a closing date (deadline keyword nearby) and an opening date (open keyword nearby)."""
    text = re.sub(r"\s+", " ", text)
    opens = closes = None
    for pos, d in find_dates(text):
        before = text[max(0, pos - 60):pos]
        if CLOSE_KW.search(before) and not closes: closes = d
        elif OPEN_KW.search(before) and not opens: opens = d
    return opens, closes


def parse_listing(html, base_url):
    """Find links that look like calls for papers on a journal's listing page."""
    soup = BeautifulSoup(html, "html.parser")
    out, seen = [], set()
    for a in soup.find_all("a", href=True):
        label = a.get_text(" ", strip=True)
        href = urljoin(base_url, a["href"]).split("#")[0]
        if len(label) < 8 or href in seen or not CFP_LINK.search(label + " " + href):
            continue
        if re.search(r"\.(pdf|docx?)$", href, re.I) is None and urlparse(href).scheme not in ("http", "https"):
            continue
        # Dates are often on the listing itself, next to the link
        ctx = a.find_parent(["li", "tr", "article", "div", "p"])
        ctx_text = ctx.get_text(" ", strip=True) if ctx else label
        seen.add(href)
        out.append({"title": label[:200], "url": href, "context": ctx_text})
    return out


class Fetcher:
    def __init__(self):
        self.s = requests.Session(); self.s.headers["User-Agent"] = UA
        self.robots = {}; self.last = 0

    def allowed(self, url):
        host = "{0.scheme}://{0.netloc}".format(urlparse(url))
        if host not in self.robots:
            rp = RobotFileParser(); rp.set_url(host + "/robots.txt")
            try: rp.read()
            except Exception: rp = None
            self.robots[host] = rp
        rp = self.robots[host]
        return True if rp is None else rp.can_fetch(UA, url)

    def get(self, url):
        if not self.allowed(url): raise RuntimeError("blocked by robots.txt")
        time.sleep(max(0, DELAY - (time.time() - self.last)))
        self.last = time.time()
        r = self.s.get(url, timeout=25)
        if r.status_code in (401, 403, 429):
            raise RuntimeError(f"site refused automated access (HTTP {r.status_code})")
        r.raise_for_status()
        return r.text


def iso(d): return d.isoformat() if d else None


def scrape_source(f, src):
    html = f.get(src["url"])
    items = parse_listing(html, src["url"])
    results = []
    for it in items[:MAX_DETAIL_PAGES]:
        opens, closes = extract_dates(it["context"])
        if not closes:                          # look on the call's own page
            try:
                opens2, closes = extract_dates(BeautifulSoup(f.get(it["url"]), "html.parser").get_text(" "))
                opens = opens or opens2
            except Exception:
                pass
        if closes and closes < TODAY: continue
        results.append({"title": it["title"], "url": it["url"], "opens": iso(opens), "closes": iso(closes)})
    return results


def load_journals():
    js = (DATA / "journals.js").read_text(encoding="utf-8-sig")
    return json.loads(js[js.index("=") + 1:].rstrip(";\n "))


def main():
    journals = load_journals()
    by_title = {re.sub(r"\W+", " ", j["title"]).lower().strip(): j["id"] for j in journals}
    jid = lambda t: by_title.get(re.sub(r"\W+", " ", t).lower().strip())

    old = []
    cf = DATA / "cfps.json"
    if cf.exists(): old = json.loads(cf.read_text(encoding="utf-8-sig"))
    # A call is identified by journal AND url: one collection can be shared by many journals
    key = lambda jid_, url_: f"{jid_}|{url_}"
    known = {key(c["journal_id"], c["url"]): c for c in old}
    fresh, report = {}, []
    checked = set()          # journals whose page was read successfully this run
    manual_only = "--manual-only" in sys.argv   # skip the network; just re-merge the CSV

    if not manual_only:
        f = Fetcher()
        for src in json.loads((ROOT / "scraper" / "sources.json").read_text(encoding="utf-8-sig")):
            i = jid(src["journal"])
            if not i: report.append(f"SKIP  {src['journal']}: not found in ABDC list"); continue
            try:
                got = scrape_source(f, src)
                checked.add(i)
                report.append(f"OK    {src['journal']}: {len(got)} call(s)")
                for g in got: fresh[key(i, g["url"])] = {**g, "journal_id": i, "source": "scraped"}
            except Exception as e:
                report.append(f"FAIL  {src['journal']}: {e}")

        # Springer Nature: structured collections pages (allowed by robots.txt)
        import springer
        log = lambda m: report.append(m)
        n = 0
        for i, c in springer.collect(journals, f.get, log, checked):
            if c["closes"] and c["closes"] < iso(TODAY): continue
            fresh[key(i, c["url"])] = {**c, "journal_id": i, "source": "scraped"}; n += 1
        log(f"OK    Springer Nature: {n} open call(s) from {len(checked)} journals read")
        if n == 0 and any(c.get("source") == "scraped" for c in old):
            print("\n".join(report)); sys.exit("Springer returned nothing; keeping the previous data and failing the run.")

    manual = ROOT / "scraper" / "manual_cfps.csv"
    if manual.exists():
        for row in csv.DictReader(manual.open(encoding="utf-8-sig")):
            i = jid(row.get("journal", ""))
            if not i or not row.get("url"): report.append(f"SKIP  manual row {row}"); continue
            fresh[key(i, row["url"])] = {"title": row.get("title") or "Call for papers", "url": row["url"],
                                 "opens": row.get("opens") or None, "closes": row.get("closes") or None,
                                 "journal_id": i, "source": "manual"}

    # Merge: fresh wins. A scraped call that has vanished from a journal we read successfully is
    # withdrawn, so drop it. If the journal could not be read this run, keep the old call
    # (until its deadline passes) rather than blank the site because of a temporary failure.
    merged = dict(fresh)
    for k, c in known.items():
        if k not in merged and c.get("source") == "scraped" and c["journal_id"] not in checked:
            merged[k] = c
    cutoff = iso(TODAY - dt.timedelta(days=KEEP_EXPIRED_DAYS))
    now = iso(TODAY)
    out = []
    for c in merged.values():
        if c.get("closes") and c["closes"] < cutoff: continue
        c["first_seen"] = known.get(key(c["journal_id"], c["url"]), {}).get("first_seen", now)
        out.append(c)
    out.sort(key=lambda c: (c["closes"] or "9999", c["journal_id"]))

    stamp = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    if manual_only:
        # No web collection happened, so keep the date of the last real one
        try:
            m = re.search(r'CFPS_UPDATED=("[^"]*")', (DATA / "cfps.js").read_text(encoding="utf-8"))
            if m: stamp = json.loads(m.group(1))
        except OSError:
            pass
    cf.write_text(json.dumps(out, indent=1), encoding="utf-8")
    (DATA / "cfps.js").write_text(f"window.CFPS={json.dumps(out, separators=(',', ':'))};window.CFPS_UPDATED={json.dumps(stamp)};", encoding="utf-8")
    print("\n".join(report)); print(f"\n{len(out)} call(s) published.")


def selftest():
    html = """<ul><li><a href="/cfp/ai">Special Issue on AI in Operations</a> Submission deadline: 15 March 2099. Submissions open 1 January 2099.</li>
    <li><a href="/about">About us</a></li></ul>"""
    items = parse_listing(html, "https://example.org/cfps")
    assert len(items) == 1 and items[0]["url"] == "https://example.org/cfp/ai", items
    o, c = extract_dates(items[0]["context"])
    assert c == dt.date(2099, 3, 15) and o == dt.date(2099, 1, 1), (o, c)
    assert extract_dates("Deadline: March 3rd, 2099")[1] == dt.date(2099, 3, 3)
    assert extract_dates("Due date 2099-05-09")[1] == dt.date(2099, 5, 9)
    print("selftest passed")


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else main()

