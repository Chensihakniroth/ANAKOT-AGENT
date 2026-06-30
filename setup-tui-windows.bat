@echo off
REM ============================================================================
REM Anakot TUI Quick-Setup (Windows)
REM ============================================================================
REM Double-click to run, or execute from cmd.exe.
REM This is a simplified version — for full control use setup-tui-windows.ps1
REM
REM Before running: clone the repo and place this file in the repo root:
REM   git clone https://github.com/Chensihakniroth/ANAKOT-AGENT.git
REM   cd anakot-agent
REM   setup-tui-windows.bat
REM ============================================================================

echo.
echo  Anakot TUI Quick-Setup
echo.

set REPO_PATH=%~dp0
set REPO_PATH=%REPO_PATH:~0,-1%
set ANAKOT_HOME=%USERPROFILE%\.anakot

REM --- Check Python ---
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] Python not found. Install from https://www.python.org/downloads/
    echo        Make sure "Add Python to PATH" is checked during install.
    pause
    exit /b 1
)
for /f "tokens=2" %%v in ('python --version 2^>^&1') do echo [OK] Python %%v

REM --- Check Node ---
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] Node.js not found. Install from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=1" %%v in ('node --version') do echo [OK] Node %%v

REM --- Check uv ---
uv --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Installing uv...
    powershell -c "Invoke-Expression (Invoke-WebRequest -Uri 'https://astral.sh/uv/install.ps1' -UseBasicParsing).Content"
    set PATH=%USERPROFILE%\.local\bin;%USERPROFILE%\.cargo\bin;%PATH%
)
uv --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] uv install failed. See https://docs.astral.sh/uv/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('uv --version') do echo [OK] %%v

REM --- Check repo ---
if not exist "%REPO_PATH%\ui-tui\package.json" (
    echo [FAIL] Repo not found at %REPO_PATH%
    echo        Clone it: git clone https://github.com/Chensihakniroth/ANAKOT-AGENT.git %REPO_PATH%
    pause
    exit /b 1
)
echo [OK] Repo found

REM --- venv ---
if exist "%REPO_PATH%\venv" rmdir /s /q "%REPO_PATH%\venv"
echo Creating venv...
uv venv "%REPO_PATH%\venv" --python 3.11
echo [OK] venv created

REM --- Python deps ---
echo Installing Python dependencies ^(this may take a few minutes^)...
set UV_PROJECT_ENVIRONMENT=%REPO_PATH%\venv
if exist "%REPO_PATH%\uv.lock" (
    uv sync --extra all --locked
) else (
    uv pip install -e "%REPO_PATH%" --extra all
)
echo [OK] Python deps installed

REM --- TUI build ---
echo Installing TUI dependencies...
cd /d "%REPO_PATH%\ui-tui"
call npm install --silent --no-fund --no-audit
echo Building TUI bundle...
call npm run build
if not exist "dist\entry.js" (
    echo [FAIL] TUI build failed — dist/entry.js not found
    pause
    exit /b 1
)
echo [OK] TUI bundle built

REM --- Env vars ---
setx ANAKOT_TUI_DIR "%REPO_PATH%\ui-tui" >nul
setx ANAKOT_HOME "%ANAKOT_HOME%" >nul
setx PYTHONUTF8 "1" >nul
echo [OK] Environment variables set

REM --- Skills ---
if not exist "%ANAKOT_HOME%\skills" mkdir "%ANAKOT_HOME%\skills"
if exist "%REPO_PATH%\skills" (
    xcopy /E /I /Y "%REPO_PATH%\skills\*" "%ANAKOT_HOME%\skills\" >nul 2>&1
    echo [OK] Skills synced
)

REM --- Done ---
echo.
echo ========================================
echo  Setup complete!
echo ========================================
echo.
echo  Restart your terminal, then run:
echo    %REPO_PATH%\venv\Scripts\anakot.exe --tui
echo.
echo  Or set up API keys first:
echo    %REPO_PATH%\venv\Scripts\anakot.exe setup
echo.
pause
