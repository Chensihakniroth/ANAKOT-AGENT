@echo off
REM ============================================================================
REM Anakot Agent Installer for Windows (CMD wrapper)
REM ============================================================================
REM This batch file launches the PowerShell installer for users running CMD.
REM
REM Usage:
REM   curl -fsSL https://raw.githubusercontent.com/Chensihakniroth/ANAKOT-AGENT/main/scripts/install.cmd -o install.cmd && install.cmd && del install.cmd
REM
REM Or if you're already in PowerShell, use the direct command instead:
REM   iex (irm https://raw.githubusercontent.com/Chensihakniroth/ANAKOT-AGENT/main/scripts/install.ps1)
REM ============================================================================

echo.
echo  Anakot Agent Installer
echo  Launching PowerShell installer...
echo.

powershell -ExecutionPolicy ByPass -NoProfile -Command "iex (irm https://raw.githubusercontent.com/Chensihakniroth/ANAKOT-AGENT/main/scripts/install.ps1)"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  Installation failed with exit code %ERRORLEVEL%.
    echo.
    echo  Please try running PowerShell directly:
    echo    powershell -ExecutionPolicy ByPass -c "iex (irm https://raw.githubusercontent.com/Chensihakniroth/ANAKOT-AGENT/main/scripts/install.ps1)"
    echo.
    echo  If the error persists, download the script and run it manually:
    echo    Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/Chensihakniroth/ANAKOT-AGENT/main/scripts/install.ps1' -OutFile install.ps1
    echo    .\install.ps1
    echo.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo  Installation complete.
echo.
