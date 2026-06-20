# Cambell Andijan — har soat yangiliklarni sync + tarjima qilish
# Ishga tushirish: PowerShell ni Administrator sifatida oching va:
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
#   .\scripts\install-auto-sync.ps1

$TaskName = "CambellNewsAutoSync"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $Python) {
    Write-Host "Python topilmadi. Avval Python o'rnating." -ForegroundColor Red
    exit 1
}

$ScriptPath = Join-Path $ProjectRoot "scripts\sync-news.py"
$Action = New-ScheduledTaskAction -Execute $Python -Argument "`"$ScriptPath`"" -WorkingDirectory $ProjectRoot
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration ([TimeSpan]::MaxValue)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "Cambell: lzgtnet.com yangiliklarini yuklash va UZ/RU tarjima qilish"

Write-Host "Tayyor! '$TaskName' har soat avtomatik ishlaydi." -ForegroundColor Green
Write-Host "Qo'lda sinash: python scripts\sync-news.py"
