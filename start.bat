@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [!] Node.js not found. Please install Node.js 20 or newer:
  echo     https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo ============================================
echo   PLCMonitor launcher
echo ============================================
echo.

node scripts\start.js
set EXITCODE=%errorlevel%

if not "%EXITCODE%"=="0" (
  echo.
  echo [!] Startup failed with exit code %EXITCODE%.
  pause
)

endlocal
exit /b %EXITCODE%
