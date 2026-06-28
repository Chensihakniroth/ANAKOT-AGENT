@echo off
setlocal EnableDelayedExpansion
title Anakot Agent - Uninstaller
color 0C

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║          ANAKOT AGENT - Uninstaller                     ║
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
echo    uninstall-anakot.bat C:\Path\To\AnakotAgent
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

:: ── Confirm ───────────────────────────────────────────────────────────

echo  ─────────────────────────────────────────────────────────
echo.
echo  This will remove Anakot Agent from your system.
echo.
echo  Install directory:  %INSTALL_DIR%
echo  Data directory:     %USERPROFILE%\.anakot
echo.
echo  The following will be DELETED:
echo    - %INSTALL_DIR%  (the application code + venv)
echo    - %USERPROFILE%\.anakot\bin\anakot.bat  (command wrapper)
echo    - %USERPROFILE%\.anakot\bin\anakot.ps1
echo    - Desktop shortcut (if created)
echo    - PATH entry for %USERPROFILE%\.anakot\bin
echo.
echo  The following will be KEPT (your personal data):
echo    - %USERPROFILE%\.anakot\config.yaml  (API keys, settings)
echo    - %USERPROFILE%\.anakot\skills\      (your skills)
echo    - %USERPROFILE%\.anakot\sessions\    (chat history)
echo    - %USERPROFILE%\.anakot\logs\        (logs)
echo    - %USERPROFILE%\.anakot\cron\        (scheduled jobs)
echo.

set /p CONFIRM="  Type YES to confirm uninstall: "
if /i not "%CONFIRM%"=="YES" (
    echo.
    echo  Cancelled.
    pause
    exit /b 0
)

echo.
echo  ─────────────────────────────────────────────────────────
echo  Uninstalling...
echo.

:: ── Step 1: Kill running anakot processes ──────────────────────────────

tasklist /FI "IMAGENAME eq python.exe" /FI "WINDOWTITLE eq anakot*" 2>nul | findstr /i "python" >nul
if %ERRORLEVEL% EQU 0 (
    echo  Stopping running Anakot processes...
    taskkill /F /IM python.exe /FI "WINDOWTITLE eq anakot*" 2>nul
    timeout /t 2 >nul
)

:: ── Step 2: Remove install directory ───────────────────────────────────

echo  Removing application files...
if exist "%INSTALL_DIR%" (
    rmdir /s /q "%INSTALL_DIR%" 2>nul
    if exist "%INSTALL_DIR%" (
        echo  [WARN] Could not fully remove %INSTALL_DIR%
        echo  Some files may be locked. Delete manually after closing all terminals.
    ) else (
        echo  [OK] Removed %INSTALL_DIR%
    )
) else (
    echo  [OK] Already removed: %INSTALL_DIR%
)

:: ── Step 3: Remove command wrappers ────────────────────────────────────

echo  Removing command wrappers...
set "BIN_DIR=%USERPROFILE%\.anakot\bin"
if exist "%BIN_DIR%\anakot.bat" (
    del /f /q "%BIN_DIR%\anakot.bat" 2>nul
    echo  [OK] Removed anakot.bat
)
if exist "%BIN_DIR%\anakot.ps1" (
    del /f /q "%BIN_DIR%\anakot.ps1" 2>nul
    echo  [OK] Removed anakot.ps1
)

:: ── Step 4: Remove from PATH ───────────────────────────────────────────

echo  Cleaning PATH...
set "USER_PATH="
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul ^| findstr /i "Path"') do set "USER_PATH=%%b"

if defined USER_PATH (
    :: Remove %BIN_DIR% from PATH
    set "NEW_PATH=!USER_PATH:%BIN_DIR%;=!"
    set "NEW_PATH=!NEW_PATH:;%BIN_DIR%=!"
    set "NEW_PATH=!NEW_PATH:%BIN_DIR%=!"
    if "!NEW_PATH!" neq "!USER_PATH!" (
        setx PATH "!NEW_PATH!" >nul 2>&1
        echo  [OK] Removed from PATH
    ) else (
        echo  [OK] PATH already clean
    )
) else (
    echo  [OK] No User PATH to clean
)

:: ── Step 5: Remove desktop shortcut ────────────────────────────────────

echo  Removing desktop shortcut...
set "DESKTOP_SHORTCUT=%USERPROFILE%\Desktop\Anakot Agent.lnk"
if exist "%DESKTOP_SHORTCUT%" (
    del /f /q "%DESKTOP_SHORTCUT%" 2>nul
    echo  [OK] Removed desktop shortcut
) else (
    echo  [OK] Desktop shortcut not found
)

:: ── Step 6: Clean up empty .anakot\bin ──────────────────────────────────

if exist "%BIN_DIR%" (
    dir /b "%BIN_DIR%" 2>nul | findstr "." >nul
    if %ERRORLEVEL% NEQ 0 (
        rmdir "%BIN_DIR%" 2>nul
        echo  [OK] Removed empty bin directory
    )
)

:: ── Step 7: Remove ANAKOT_HOME env var ─────────────────────────────────

reg delete "HKCU\Environment" /v ANAKOT_HOME /f >nul 2>&1
echo  [OK] Cleaned environment variables.

:: ── Done ───────────────────────────────────────────────────────────────

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║                 UNINSTALL COMPLETE!                      ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
echo  Your personal data is still at:
echo    %USERPROFILE%\.anakot\
echo.
echo  To remove it too, delete that folder manually.
echo  To reinstall later, run install-anakot.bat again.
echo.
pause
