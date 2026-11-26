# Called daily by the scheduled task. Runs update-calls.ps1 only if no successful update has run this calendar month.
Set-Location $PSScriptRoot
$stamp = Join-Path $PSScriptRoot ".last-monthly-run"
$thisMonth = Get-Date -Format "yyyy-MM"
if ((Test-Path $stamp) -and ((Get-Content $stamp -Raw).Trim() -eq $thisMonth)) { exit 0 }

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "update-calls.ps1")
if ($LASTEXITCODE -eq 0) { Set-Content -Path $stamp -Value $thisMonth }
