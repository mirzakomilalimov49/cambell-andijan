@echo off
cd /d "%~dp0"
if not exist "node_modules\" (
  echo Paketlar o'rnatilmoqda...
  call npm install
)
if not exist ".env" (
  echo.
  echo DIQQAT: .env fayli topilmadi!
  echo 1. .env.example faylini .env deb nusxalang
  echo 2. GEMINI_API_KEY= kalitingizni yozing
  echo.
  copy /Y .env.example .env >nul 2>&1
)
echo Sayt ishga tushmoqda...
npm start
