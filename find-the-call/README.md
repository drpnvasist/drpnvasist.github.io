# Find the Call

Open calls for papers across journals on the 2025 ABDC Journal Quality List. A static site (`site/`) plus a monthly collector (`scraper/`), published free with GitHub Pages.

> Generated with AI. Dates, links and ratings can be wrong or out of date. Confirm on the journal's own homepage.

## Publish it (one-time setup)

1. On GitHub, create a **public** repository (for example `find-the-call`). Leave it empty.
2. Upload this folder's contents to it, with `site/`, `scraper/`, `.github/` and `requirements.txt` at the top level. Using git:
   ```powershell
   git init -b main
   git add .
   git commit -m "Initial site"
   git remote add origin https://github.com/<you>/find-the-call.git
   git push -u origin main
   ```
3. **Settings > Pages > Build and deployment > Source: GitHub Actions.**
4. **Actions tab > "Refresh calls and publish site" > Run workflow.** The first run takes about 15 to 20 minutes.
5. Your site appears at `https://<you>.github.io/find-the-call/` (the run's "deploy" step prints the exact link).

GitHub publishes the site. It does **not** collect calls: Springer refuses requests from GitHub's servers. Calls are collected monthly on your own PC (next section).

## Monthly collection (on your PC)

One-time setup:
1. Install [Git](https://git-scm.com/download/win) and Python 3.12+.
2. Clone the repository somewhere permanent, for example `git clone https://github.com/<you>/find-the-call.git "$HOME\find-the-call"`. Sign in to GitHub when asked.
3. In that folder run `powershell -ExecutionPolicy Bypass -File setup-monthly-task.ps1` once.

After that, once a month (the next time the PC is on) `update-calls.ps1` collects the calls, commits the new data and pushes it. GitHub then republishes the site and the date at the top changes. To run it now: `powershell -ExecutionPolicy Bypass -File update-calls.ps1`. Its log is `update-calls.log`.

## Day to day

- **Add a call by hand** (for publishers that block automated access): add a row to `scraper/manual_cfps.csv` and push. The site updates within minutes.
  Columns: `journal,title,url,opens,closes`. The journal name must match the ABDC title; dates are `YYYY-MM-DD`. Leave `closes` blank if there is no deadline.
- **Refresh now:** Actions tab > Run workflow.
- **Check it's healthy:** the Actions tab shows each run's log, including which sources failed. A failed run leaves the previous data on the site.

## Journal homepages

Every journal title links to its homepage. Links come from the OpenAlex index by ISSN (`scraper/build_homepages.py`, cached in `scraper/homepages.json`). Where OpenAlex has none, the link opens the journal's ISSN record, or a web search if it has no ISSN. Re-run the script with `--refresh` to look everything up again.

## Match my research

The "Match my research" box suggests journals and open calls from a topic and keywords. It is plain keyword scoring that runs in the visitor's browser: no AI service, nothing typed is sent anywhere. It compares the words with the topics each journal publishes on (OpenAlex, `scraper/build_topics.py`, cached in `scraper/topics.json`), journal titles, ABDC field names and open call titles. Journal suggestions work for every journal, so they don't depend on the call list being complete.

## What is covered

| Source | Status |
|---|---|
| Springer Nature journals | Automatic, monthly, from your PC |
| `scraper/manual_cfps.csv` | Whatever you add by hand |
| Other publishers | Added by hand (many do not allow automated collection) |

The scraper identifies itself, obeys robots.txt and waits 2 seconds between requests. It does not try to get around blocks.

## Updating the ABDC list

When ABDC publishes a new list, run:
```powershell
python scraper/build_journals.py "path\to\ABDC-list.xlsx" site/data/journals.js
```
(You may need to change the sheet name inside `build_journals.py`.)

## Local preview

Open `site/index.html` in a browser. No server needed.

Ratings: Australian Business Deans Council (ABDC) Journal Quality List. This site is not affiliated with or endorsed by ABDC.
