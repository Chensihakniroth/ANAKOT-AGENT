@echo off
setlocal EnableDelayedExpansion
title Anakot Agent - Updater
color 0B

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║           ANAKOT AGENT - Update Installer               ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: ── Find install directory ────────────────────────────────────────────

:: Check common locations
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

:: Check PATH
for %%i in (anakot.exe) do (
    set "ANAKOT_PATH=%%~$PATH:i"
    if defined ANAKOT_PATH (
        for %%d in ("%%ANAKOT_PATH%") do (
            set "INSTALL_DIR=%%~dpd"
            set "INSTALL_DIR=!INSTALL_DIR:~0,-1!"
            for %%e in ("!INSTALL_DIR!") do set "INSTALL_DIR=%%~dpe"
            set "INSTALL_DIR=!INSTALL_DIR:~0,-1!"
            goto :FOUND_INSTALL
        )
    )
)

echo  [FAIL] Could not find Anakot Agent installation.
echo.
echo  Run this script from your Anakot Agent install directory,
echo  or pass the path as an argument:
echo    update-anakot.bat C:\Path\To\AnakotAgent
echo.
pause
exit /b 1

:FOUND_INSTALL
if not "%~1"=="" set "INSTALL_DIR=%~1"
set "INSTALL_DIR=%INSTALL_DIR:"=%"

if not exist "%INSTALL_DIR%\venv\Scripts\anakot.exe" (
    echo  [FAIL] Not a valid Anakot Agent install: %INSTALL_DIR%
    pause
    exit /b 1
)

echo  Found: %INSTALL_DIR%
echo.

:: ── Step 1: Git pull + built-in update ─────────────────────────────────

echo  ─────────────────────────────────────────────────────────
echo  Step 1: Pulling latest code + updating dependencies...
echo.

cd /d "%INSTALL_DIR%"

:: Run the built-in update (git pull + node deps)
call "%INSTALL_DIR%\venv\Scripts\anakot.exe" update
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [WARN] Built-in update returned error code %ERRORLEVEL%.
    echo  Continuing with rebuild anyway...
)

:: ── Step 2: Rebuild TUI ────────────────────────────────────────────────

echo.
echo  ─────────────────────────────────────────────────────────
echo  Step 2: Rebuilding TUI frontend...
echo.

cd /d "%INSTALL_DIR%\ui-tui"

if not exist "dist\entry.js" (
    echo  No existing build found, doing full npm install first...
    call npm install --ignore-scripts --no-fund --no-audit
)

call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [WARN] TUI build failed. You can still use --cli mode.
    echo  Retry manually: cd %INSTALL_DIR%\ui-tui ^&^& npm run build
) else (
    echo  [OK] TUI rebuilt.
)

:: ── Step 3: Rebuild Desktop App ──────────────────────────────────────────

echo.
echo  ─────────────────────────────────────────────────────────
echo  Step 3: Rebuilding Desktop App...
echo.

cd /d "%INSTALL_DIR%\apps\desktop"

if not exist "node_modules" (
    echo  No existing node_modules found, doing full npm install first...
    call npm install --ignore-scripts --no-fund --no-audit
)

call npm run pack
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [WARN] Desktop app build failed.
    echo  Retry manually: cd %INSTALL_DIR%\apps\desktop ^&^& npm run pack
) else (
    echo  [OK] Desktop app rebuilt.
)

:: ── Step 4: Update uv itself ───────────────────────────────────────────

echo.
echo  ─────────────────────────────────────────────────────────
echo  Step 4: Updating uv package manager...
echo.

uv --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    uv self update 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo  [OK] uv updated.
    ) else (
        echo  [OK] uv already up to date.
    )
)

:: ── Done ───────────────────────────────────────────────────────────────

cd /d "%INSTALL_DIR%"

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║                    UPDATE COMPLETE!                      ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
echo  Restart any running Anakot sessions to use the new version.
echo.
echo  Quick test:  anakot --version
echo.

pause
