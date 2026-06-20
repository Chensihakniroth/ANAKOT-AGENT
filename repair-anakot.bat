@echo off
setlocal EnableDelayedExpansion
title Anakot Agent - Repair Tool
color 0E

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║           ANAKOT AGENT - Repair Tool                    ║
echo  ║                                                        ║
echo  ║   Fixes common issues without reinstalling              ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: ── Find install directory ────────────────────────────────────────────

set "INSTALL_DIR="
for %%p in (
    "%USERPROFILE%\AnakotAgent"
    "D:\Apps\AnakotAgent"
    "C:\AnakotAgent"
) do (
    if exist "%%~p\venv\Scripts\anakot.exe" (
        set "INSTALL_DIR=%%~p"
        goto :FOUND_INSTALL
    )
)

if not "%~1"=="" (
    set "INSTALL_DIR=%~1"
    set "INSTALL_DIR=%INSTALL_DIR:"=%"
)

if not exist "%INSTALL_DIR%\venv\Scripts\anakot.exe" (
    echo  [FAIL] Could not find Anakot Agent installation.
    echo.
    echo  Usage: repair-anakot.bat [install-path]
    echo  Example: repair-anakot.bat C:\Users\You\AnakotAgent
    echo.
    pause
    exit /b 1
)

:FOUND_INSTALL
echo  Found: %INSTALL_DIR%
echo.

:: ── Menu ───────────────────────────────────────────────────────────────

:MENU
echo  ─────────────────────────────────────────────────────────
echo  What do you want to fix?
echo.
echo    [1] Rebuild TUI frontend  (fixes blank/broken TUI)
echo    [2] Reinstall Python deps (fixes import errors)
echo    [3] Reinstall Node deps   (fixes npm-related errors)
echo    [4] Fix PATH              (fixes "anakot not recognized")
echo    [5] Fix permissions       (fixes access denied errors)
echo    [6] Clean rebuild         (rebuild everything from scratch)
echo    [7] Run diagnostics      (check what's wrong)
echo.
echo    [0] Exit
echo.
set /p CHOICE="  Enter choice: "

if "%CHOICE%"=="1" goto :REBUILD_TUI
if "%CHOICE%"=="2" goto :REINSTALL_PYTHON
if "%CHOICE%"=="3" goto :REINSTALL_NODE
if "%CHOICE%"=="4" goto :FIX_PATH
if "%CHOICE%"=="5" goto :FIX_PERMISSIONS
if "%CHOICE%"=="6" goto :CLEAN_REBUILD
if "%CHOICE%"=="7" goto :DIAGNOSTICS
if "%CHOICE%"=="0" exit /b 0

echo  Invalid choice.
goto :MENU

:: ── Rebuild TUI ───────────────────────────────────────────────────────

:REBUILD_TUI
echo.
echo  ─────────────────────────────────────────────────────────
echo  Rebuilding TUI frontend...
echo.

cd /d "%INSTALL_DIR%\ui-tui"

echo  Installing npm dependencies...
call npm install --ignore-scripts --no-fund --no-audit

echo  Building TUI bundle...
call npm run build 2>nul

if exist "dist\entry.js" (
    echo  [OK] TUI rebuilt successfully.
) else (
    echo  [FAIL] TUI build failed. Check error messages above.
)

cd /d "%INSTALL_DIR%"
echo.
pause
goto :MENU

:: ── Reinstall Python deps ──────────────────────────────────────────────

:REINSTALL_PYTHON
echo.
echo  ─────────────────────────────────────────────────────────
echo  Reinstalling Python dependencies...
echo.

cd /d "%INSTALL_DIR%"
set "UV_PROJECT_ENVIRONMENT=%INSTALL_DIR%\venv"

echo  This may take a few minutes...
uv pip install -e ".[cron,cli,pty,mcp]" 2>&1

if %ERRORLEVEL% EQU 0 (
    echo  [OK] Python dependencies reinstalled.
) else (
    echo  [WARN] Some dependencies may have failed. Check output above.
)

echo.
pause
goto :MENU

:: ── Reinstall Node deps ────────────────────────────────────────────────

:REINSTALL_NODE
echo.
echo  ─────────────────────────────────────────────────────────
echo  Reinstalling Node.js dependencies...
echo.

cd /d "%INSTALL_DIR%\ui-tui"

echo  Cleaning old node_modules...
if exist "node_modules" rmdir /s /q "node_modules" 2>nul

echo  Installing...
call npm install --ignore-scripts --no-fund --no-audit

if %ERRORLEVEL% EQU 0 (
    echo  [OK] Node dependencies reinstalled.
) else (
    echo  [WARN] npm install had issues. Check output above.
)

cd /d "%INSTALL_DIR%"
echo.
pause
goto :MENU

:: ── Fix PATH ───────────────────────────────────────────────────────────

:FIX_PATH
echo.
echo  ─────────────────────────────────────────────────────────
echo  Fixing PATH...
echo.

set "BIN_DIR=%USERPROFILE%\.anakot\bin"
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

:: Recreate wrapper scripts
(
echo @echo off
echo set "ANAKOT_HOME=%USERPROFILE%\.anakot"
echo set "PYTHONUTF8=1"
echo "%INSTALL_DIR%\venv\Scripts\python.exe" -m anakot_cli.main %%*
) > "%BIN_DIR%\anakot.bat"

(
echo $env:ANAKOT_HOME = "%USERPROFILE%\.anakot"
echo $env:PYTHONUTF8 = "1"
echo ^& "%INSTALL_DIR%\venv\Scripts\python.exe" -m anakot_cli.main @args
) > "%BIN_DIR%\anakot.ps1"

echo  [OK] Wrapper scripts recreated.

:: Add to PATH
set "USER_PATH="
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul ^| findstr /i "Path"') do set "USER_PATH=%%b"

echo %USER_PATH% | findstr /i "%BIN_DIR%" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if defined USER_PATH (
        setx PATH "%BIN_DIR%;%USER_PATH%" >nul 2>&1
    ) else (
        setx PATH "%BIN_DIR%" >nul 2>&1
    )
    echo  [OK] Added to User PATH: %BIN_DIR%
) else (
    echo  [OK] Already on PATH.
)

:: Set ANAKOT_HOME
setx ANAKOT_HOME "%USERPROFILE%\.anakot" >nul 2>&1
echo  [OK] ANAKOT_HOME set to %USERPROFILE%\.anakot

echo.
echo  Restart your terminal, then try: anakot --version
echo.
pause
goto :MENU

:: ── Fix permissions ────────────────────────────────────────────────────

:FIX_PERMISSIONS
echo.
echo  ─────────────────────────────────────────────────────────
echo  Fixing file permissions...
echo.

echo  Taking ownership of install directory...
icacls "%INSTALL_DIR%" /grant "%USERNAME%:F" /T /C 2>nul
if %ERRORLEVEL% EQU 0 (
    echo  [OK] Permissions fixed for %INSTALL_DIR%
) else (
    echo  [WARN] Could not fix permissions. Try running as Administrator.
)

echo.
pause
goto :MENU

:: ── Clean rebuild ──────────────────────────────────────────────────────

:CLEAN_REBUILD
echo.
echo  ─────────────────────────────────────────────────────────
echo  Clean rebuilding everything...
echo.
echo  WARNING: This will delete and recreate your venv.
echo  Your config and data in %USERPROFILE%\.anakot\ will be kept.
echo.

set /p CONFIRM="  Type YES to confirm: "
if /i not "%CONFIRM%"=="YES" (
    echo  Cancelled.
    goto :MENU
)

cd /d "%INSTALL_DIR%"

:: Remove old venv
echo  Removing old venv...
if exist "venv" rmdir /s /q "venv" 2>nul

:: Create fresh venv
echo  Creating new venv...
uv venv venv --python 3.11
if %ERRORLEVEL% NEQ 0 (
    echo  [FAIL] venv creation failed.
    pause
    goto :MENU
)

:: Install deps
echo  Installing dependencies (this takes a few minutes)...
set "UV_PROJECT_ENVIRONMENT=%INSTALL_DIR%\venv"
if exist "uv.lock" (
    uv sync --extra all --locked 2>&1
    if %ERRORLEVEL% NEQ 0 (
        uv pip install -e ".[cron,cli,pty,mcp]" 2>&1
    )
) else (
    uv pip install -e ".[cron,cli,pty,mcp]" 2>&1
)

:: Rebuild TUI
echo  Rebuilding TUI...
cd /d "%INSTALL_DIR%\ui-tui"
call npm install --ignore-scripts --no-fund --no-audit
call npm run build 2>nul
cd /d "%INSTALL_DIR%"

echo.
echo  [OK] Clean rebuild complete.
echo  Restart your terminal, then try: anakot --version
echo.
pause
goto :MENU

:: ── Diagnostics ────────────────────────────────────────────────────────

:DIAGNOSTICS
echo.
echo  ─────────────────────────────────────────────────────────
echo  Running diagnostics...
echo.

echo  === System ===
python --version 2>nul && echo  [OK] Python || echo  [FAIL] Python not found
node --version 2>nul && echo  [OK] Node.js || echo  [FAIL] Node.js not found
git --version 2>nul && echo  [OK] Git || echo  [FAIL] Git not found
uv --version 2>nul && echo  [OK] uv || echo  [FAIL] uv not found
echo.

echo  === Installation ===
if exist "%INSTALL_DIR%\venv\Scripts\python.exe" (
    echo  [OK] venv exists
) else (
    echo  [FAIL] venv missing
)
if exist "%INSTALL_DIR%\venv\Scripts\anakot.exe" (
    echo  [OK] anakot.exe exists
) else (
    echo  [FAIL] anakot.exe missing
)
if exist "%INSTALL_DIR%\ui-tui\dist\entry.js" (
    echo  [OK] TUI built
) else (
    echo  [WARN] TUI not built (use --cli mode or rebuild)
)
echo.

echo  === PATH ===
set "BIN_DIR=%USERPROFILE%\.anakot\bin"
set "USER_PATH="
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul ^| findstr /i "Path"') do set "USER_PATH=%%b"
echo %USER_PATH% | findstr /i "%BIN_DIR%" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo  [OK] %BIN_DIR% is on PATH
) else (
    echo  [WARN] %BIN_DIR% NOT on PATH
)
echo.

echo  === Import Test ===
"%INSTALL_DIR%\venv\Scripts\python.exe" -c "import anakot_cli.main; print('OK')" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo  [OK] Backend imports work
) else (
    echo  [FAIL] Backend import failed
)
echo.

echo  === Config ===
if exist "%USERPROFILE%\.anakot\config.yaml" (
    echo  [OK] config.yaml exists
) else (
    echo  [INFO] config.yaml not found (run: anakot setup)
)
if exist "%USERPROFILE%\.anakot\.env" (
    echo  [OK] .env exists
) else (
    echo  [INFO] .env not found (API keys may be in config.yaml)
)
echo.

echo  === Disk Space ===
for /f "tokens=3" %%a in ('dir /-c "%INSTALL_DIR%" 2^>nul ^| findstr /i "bytes free"') do (
    echo  Free space: %%a bytes
)
echo.

echo  ─────────────────────────────────────────────────────────
echo  Diagnostics complete.
echo.
pause
goto :MENU
