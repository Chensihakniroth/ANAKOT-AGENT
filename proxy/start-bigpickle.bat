@echo off
setlocal EnableExtensions
set "PS1=%~dp0start-bigpickle.ps1"
if not exist "%PS1%" (
  echo [error] start-bigpickle.ps1 not found next to this launcher.
  pause
  exit /b 1
)

REM Prefer PowerShell 7+ (pwsh), fall back to Windows PowerShell 5.1.
set "SHELL=pwsh.exe"
where pwsh.exe >nul 2>&1 || set "SHELL=powershell.exe"

"%SHELL%" -NoProfile -ExecutionPolicy Bypass -File "%PS1%"

echo.
pause
endlocal