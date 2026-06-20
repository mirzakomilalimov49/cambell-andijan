@echo off
cd /d "%~dp0.."
echo Syncing news from lzgtnet.com...
python scripts\sync-news.py
echo Done. Refresh the website to see new articles.
pause
