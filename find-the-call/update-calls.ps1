# Monthly collector. Runs on your own PC, then pushes the new data to GitHub, which republishes the site.
# Run by hand:  powershell -ExecutionPolicy Bypass -File update-calls.ps1
# Scheduled by: setup-monthly-task.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$log = Join-Path $PSScriptRoot "update-calls.log"
Start-Transcript -Path $log -Force | Out-Null

try {
    git pull --rebase
    python -m pip install -q -r requirements.txt
    python scraper/scrape_cfps.py
    if ($LASTEXITCODE -ne 0) { throw "The collector failed. Nothing was pushed; the site keeps the old data." }
    python scraper/build_homepages.py
    python scraper/build_topics.py

    git add site/data/cfps.js site/data/cfps.json scraper/springer_ids.json site/data/homepages.js scraper/homepages.json site/data/topics.js scraper/topics.json
    git diff --staged --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "No changes to publish."
    } else {
        git commit -m ("Monthly update " + (Get-Date -Format "yyyy-MM-dd"))
        git push
        Write-Host "Pushed. GitHub will republish the site in a few minutes."
    }
} finally {
    Stop-Transcript | Out-Null
}
