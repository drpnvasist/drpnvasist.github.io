# Run this ONCE to schedule the monthly update.
# Windows checks daily at 10:00 (or the next time the PC is on); monthly-check.ps1 runs the
# update only if one has not already succeeded this calendar month.

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\monthly-check.ps1`"" `
    -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -Daily -DaysInterval 1 -At 10:00
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "Find the Call monthly update" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "Scheduled. It checks daily and updates once a month."
