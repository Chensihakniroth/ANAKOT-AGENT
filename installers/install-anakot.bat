@echo off
setlocal
title Anakot Agent - Installer
color 0A

:: ═══════════════════════════════════════════════════════════════
::  BANNER
:: ═══════════════════════════════════════════════════════════════

echo.
echo.
echo         █████╗ ███╗   ██╗ █████╗ ██╗  ██╗ ██████╗ ████████╗
echo        ██╔══██╗████╗  ██║██╔══██╗██║ ██╔╝██╔═══██╗╚══██╔══╝
echo        ███████║██╔██╗ ██║███████║█████╔╝ ██║   ██║   ██║   
echo        ██╔══██║██║╚██╗██║██╔══██║██╔═██╗ ██║   ██║   ██║   
echo        ██║  ██║██║ ╚████║██║  ██║██║  ██╗╚██████╔╝   ██║   
echo        ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝    ╚═╝   
echo.
echo              A G E N T   -   I n s t a l l e r
echo.
echo        ┌─────────────────────────────────────────────┐
echo        │  Backend + TUI + Desktop GUI                │
echo        │  Auto-installs: Python, Node.js, Git, uv    │
echo        └─────────────────────────────────────────────┘
echo.
echo.

:: ═══════════════════════════════════════════════════════════════
::  STEP 1: PYTHON
:: ═══════════════════════════════════════════════════════════════

echo    [1/4] Checking Python 3.11+...
echo.

set "PYTHON_CMD="
python3 --version >nul 2>&1
if %ERRORLEVEL% EQU 0 set "PYTHON_CMD=python3"
if not defined PYTHON_CMD (
    python --version >nul 2>&1
    if %ERRORLEVEL% EQU 0 set "PYTHON_CMD=python"
)
if not defined PYTHON_CMD (
    py --version >nul 2>&1
    if %ERRORLEVEL% EQU 0 set "PYTHON_CMD=py"
)
if defined PYTHON_CMD goto :PYTHON_OK

echo          Python not found. Installing...
echo.

winget --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo          → Installing via winget ^(1-2 min^)...
    winget install Python.Python.3.11 --accept-package-agreements --accept-source-agreements
    if %ERRORLEVEL% EQU 0 (
        set "PATH=%LOCALAPPDATA%\Programs\Python\Python311;%PATH%"
        set "PYTHON_CMD=python"
        goto :PYTHON_OK
    )
)

echo          → Downloading Python 3.11...
powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe' -OutFile '%TEMP%\python-3.11.exe' -UseBasicParsing"
if exist "%TEMP%\python-3.11.exe" (
    echo          → Running installer...
    start /wait "" "%TEMP%\python-3.11.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1
    del "%TEMP%\python-3.11.exe" 2>nul
    set "PATH=%LOCALAPPDATA%\Programs\Python\Python311;%PATH%"
    set "PYTHON_CMD=python"
    goto :PYTHON_OK
)

echo.
echo          ✘ Could not install Python automatically.
echo            Install from: https://www.python.org/downloads/
pause
exit /b 1

:PYTHON_OK
for /f "tokens=2" %%v in ('%PYTHON_CMD% --version 2^>^&1') do set "PY_VER=%%v"
for /f "tokens=1,2 delims=." %%a in ("%PY_VER%") do (
    set "PY_MAJOR=%%a"
    set "PY_MINOR=%%b"
)
if %PY_MAJOR% GEQ 3 (
    if %PY_MINOR% GEQ 11 (
        echo          ✔ Python %PY_VER% found.
        echo.
        goto :STEP2
    )
)
echo          ✘ Python %PY_VER% is too old. Need 3.11+.
pause
exit /b 1

:: ═══════════════════════════════════════════════════════════════
::  STEP 2: NODE.JS
:: ═══════════════════════════════════════════════════════════════

:STEP2
echo    [2/4] Checking Node.js 20+...
echo.

node --version >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :NODE_OK

echo          Node.js not found. Installing Node.js 22 LTS...
echo.

winget --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo          → Installing via winget ^(1-2 min^)...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if %ERRORLEVEL% EQU 0 (
        set "PATH=%ProgramFiles%\nodejs;%PATH%"
        goto :NODE_OK
    )
)

echo          → Downloading Node.js 22 LTS...
powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi' -OutFile '%TEMP%\node-v22-x64.msi' -UseBasicParsing"
if exist "%TEMP%\node-v22-x64.msi" (
    echo          → Running installer ^(follow the prompts^)...
    echo.
    start /wait msiexec /i "%TEMP%\node-v22-x64.msi" /passive /norestart
    del "%TEMP%\node-v22-x64.msi" 2>nul
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    goto :NODE_OK
)

echo.
echo          ✘ Could not install Node.js automatically.
echo            Install from: https://nodejs.org/
pause
exit /b 1

:NODE_OK
for /f "tokens=1 delims=v" %%v in ('node --version') do set "NODE_VER=%%v"
for /f "tokens=1 delims=." %%a in ("%NODE_VER%") do set "NODE_MAJOR=%%a"
if %NODE_MAJOR% GEQ 20 (
    echo          ✔ Node.js %NODE_VER% found.
    echo.
    goto :STEP3
)
echo          ✘ Node.js %NODE_VER% is too old. Need 20+.
pause
exit /b 1

:: ═══════════════════════════════════════════════════════════════
::  STEP 3: GIT
:: ═══════════════════════════════════════════════════════════════

:STEP3
echo    [3/4] Checking Git...
echo.

git --version >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :GIT_OK

echo          Git not found. Installing...
echo.

winget --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo          → Installing via winget ^(1-2 min^)...
    winget install Git.Git --accept-package-agreements --accept-source-agreements
    if %ERRORLEVEL% EQU 0 (
        set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
        goto :GIT_OK
    )
)

echo          → Downloading Git...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe' -OutFile '%TEMP%\git-installer.exe' -UseBasicParsing"
if exist "%TEMP%\git-installer.exe" (
    echo          → Running installer ^(follow the prompts^)...
    echo.
    start /wait "" "%TEMP%\git-installer.exe" /VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS="icons,ext\reg\shellhere,assoc,assoc_sh"
    del "%TEMP%\git-installer.exe" 2>nul
    set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
    goto :GIT_OK
)

echo.
echo          ✘ Could not install Git automatically.
echo            Install from: https://git-scm.com/download/win
pause
exit /b 1

:GIT_OK
for /f "tokens=3" %%v in ('git --version') do echo          ✔ Git %%v
echo.

:: ═══════════════════════════════════════════════════════════════
::  STEP 4: UV
:: ═══════════════════════════════════════════════════════════════

echo    [4/4] Checking uv ^(Python package manager^)...
echo.

uv --version >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :UV_OK

echo          uv not found. Installing...
echo.

winget --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo          → Installing via winget...
    winget install astral-sh.uv --accept-package-agreements --accept-source-agreements
    if %ERRORLEVEL% EQU 0 (
        set "PATH=%USERPROFILE%\.local\bin;%USERPROFILE%\.cargo\bin;%PATH%"
        goto :UV_OK
    )
)

echo          → Installing via official installer...
powershell -ExecutionPolicy ByPass -Command "irm https://astral.sh/uv/install.ps1 | iex"
set "PATH=%USERPROFILE%\.local\bin;%USERPROFILE%\.cargo\bin;%PATH%"

uv --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo          ✘ uv install failed.
    echo            Install from: https://docs.astral.sh/uv/
    pause
    exit /b 1
)

:UV_OK
for /f "tokens=*" %%v in ('uv --version') do echo          ✔ %%v
echo.

:: ═══════════════════════════════════════════════════════════════
::  INSTALL DIRECTORY
:: ═══════════════════════════════════════════════════════════════

echo    ─────────────────────────────────────────────────────
echo.
echo    Where do you want to install Anakot Agent?
echo.
echo      [1]  %USERPROFILE%\AnakotAgent  ^(recommended^)
echo      [2]  Custom folder
echo      [3]  Current folder ^(portable^)
echo.
set /p "INSTALL_CHOICE=    Enter 1, 2, or 3 [1]: "
if "%INSTALL_CHOICE%"=="" set "INSTALL_CHOICE=1"

if "%INSTALL_CHOICE%"=="1" (
    set "INSTALL_DIR=%USERPROFILE%\AnakotAgent"
) else if "%INSTALL_CHOICE%"=="2" (
    echo.
    set /p "INSTALL_DIR=    Enter full path: "
    if "%INSTALL_DIR%"=="" (
        echo    ✘ No path entered.
        pause
        exit /b 1
    )
) else if "%INSTALL_CHOICE%"=="3" (
    set "INSTALL_DIR=%CD%\AnakotAgent"
) else (
    set "INSTALL_DIR=%USERPROFILE%\AnakotAgent"
)

set "INSTALL_DIR=%INSTALL_DIR:"=%"

echo.
echo    → Install directory: %INSTALL_DIR%
echo.

if exist "%INSTALL_DIR%" (
    echo    ⚠ Directory already exists!
    set /p "OVERWRITE=    Delete and reinstall? [y/N]: "
    if /i not "%OVERWRITE%"=="y" (
        echo    Cancelled.
        pause
        exit /b 0
    )
    echo    → Cleaning old install...
    rmdir /s /q "%INSTALL_DIR%" 2>nul
    if exist "%INSTALL_DIR%" (
        echo    ✘ Could not remove %INSTALL_DIR%
        pause
        exit /b 1
    )
)

:: ═══════════════════════════════════════════════════════════════
::  CLONE REPO
:: ═══════════════════════════════════════════════════════════════

echo.
echo    ─────────────────────────────────────────────────────
echo    Cloning repository...
echo.

set "TEMP_DIR=%TEMP%\anakot-install-%RANDOM%"
git clone --depth 1 --filter=blob:none --sparse https://github.com/Chensihakniroth/ANAKOT-AGENT.git "%TEMP_DIR%"
if %ERRORLEVEL% NEQ 0 (
    echo    ✘ Git clone failed. Check your internet connection.
    pause
    exit /b 1
)

cd /d "%TEMP_DIR%"
git sparse-checkout set --no-cone ^
    anakot_cli/ ^
    agent/ ^
    cli.py ^
    run_agent.py ^
    model_tools.py ^
    toolsets.py ^
    toolset_distributions.py ^
    batch_runner.py ^
    trajectory_compressor.py ^
    anakot_bootstrap.py ^
    anakot_constants.py ^
    anakot_state.py ^
    anakot_time.py ^
    anakot_logging.py ^
    utils.py ^
    mcp_serve.py ^
    acp_adapter/ ^
    acp_registry/ ^
    cron/ ^
    gateway/ ^
    providers/ ^
    tools/ ^
    skills/ ^
    optional-skills/ ^
    plugins/ ^
    locales/ ^
    tui_gateway/ ^
    ui-tui/ ^
    pyproject.toml ^
    uv.lock ^
    setup.py ^
    MANIFEST.in ^
    LICENSE ^
    README.md ^
    cli-config.yaml.example ^
    constraints-termux.txt

move "%TEMP_DIR%" "%INSTALL_DIR%" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    xcopy /E /I /Y "%TEMP_DIR%" "%INSTALL_DIR%" >nul 2>&1
    rmdir /s /q "%TEMP_DIR%" 2>nul
)
cd /d "%INSTALL_DIR%"

echo    ✔ Repository cloned.
echo.

:: ═══════════════════════════════════════════════════════════════
::  CREATE VENV
:: ═══════════════════════════════════════════════════════════════

echo    ─────────────────────────────────────────────────────
echo    Creating Python virtual environment...
echo.

uv venv venv --python 3.11
if %ERRORLEVEL% NEQ 0 (
    echo    ✘ venv creation failed.
    pause
    exit /b 1
)
echo    ✔ venv created.
echo.

:: ═══════════════════════════════════════════════════════════════
::  INSTALL PYTHON DEPS
:: ═══════════════════════════════════════════════════════════════

echo    ─────────────────────────────────────────────────────
echo    Installing Python dependencies ^(2-5 minutes^)...
echo.

set "UV_PROJECT_ENVIRONMENT=%INSTALL_DIR%\venv"

if exist "uv.lock" (
    echo    → Using uv.lock for verified install...
    uv sync --extra all --locked
    if %ERRORLEVEL% NEQ 0 (
        echo    → Lockfile sync failed, trying without lock...
        uv pip install -e ".[cron,cli,pty,mcp]"
    )
) else (
    uv pip install -e ".[cron,cli,pty,mcp]"
)

if %ERRORLEVEL% NEQ 0 (
    echo    ⚠ Some optional deps failed. Core should still work.
)

echo    ✔ Dependencies installed.
echo.

:: ═══════════════════════════════════════════════════════════════
::  BUILD TUI
:: ═══════════════════════════════════════════════════════════════

echo    ─────────────────────────────────────────────────────
echo    Building TUI frontend...
echo.

cd /d "%INSTALL_DIR%\ui-tui"

call npm install --ignore-scripts --no-fund --no-audit
if %ERRORLEVEL% NEQ 0 (
    echo    → npm install had issues, retrying...
    call npm install --ignore-scripts --no-fund --no-audit
)

call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo    ⚠ TUI build failed. You can still use --cli mode.
) else (
    echo    ✔ TUI built.
)

cd /d "%INSTALL_DIR%"
echo.

:: ═══════════════════════════════════════════════════════════════
::  BUILD DESKTOP APP
:: ═══════════════════════════════════════════════════════════════

echo    ─────────────────────────────────────────────────────
echo    Building Desktop App (1-3 minutes)...
echo.

cd /d "%INSTALL_DIR%\apps\desktop"

call npm install --ignore-scripts --no-fund --no-audit
if %ERRORLEVEL% NEQ 0 (
    echo    → npm install had issues, retrying...
    call npm install --ignore-scripts --no-fund --no-audit
)

call npm run pack
if %ERRORLEVEL% NEQ 0 (
    echo    ⚠ Desktop build failed.
) else (
    echo    ✔ Desktop app built successfully.
    
    :: Create Desktop Shortcut
    echo    → Creating Desktop Shortcut...
    set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Anakot Agent.lnk"
    set "TARGET_PATH=%INSTALL_DIR%\apps\desktop\release\win-unpacked\Anakot.exe"
    set "WORKING_DIR=%INSTALL_DIR%\apps\desktop\release\win-unpacked"
    
    powershell -Command "$wshell = New-Object -ComObject WScript.Shell; $shortcut = $wshell.CreateShortcut('%SHORTCUT_PATH%'); $shortcut.TargetPath = '%TARGET_PATH%'; $shortcut.WorkingDirectory = '%WORKING_DIR%'; $shortcut.Save()"
    if %ERRORLEVEL% EQU 0 (
        echo    ✔ Desktop shortcut created.
    ) else (
        echo    ⚠ Failed to create desktop shortcut.
    )
)

cd /d "%INSTALL_DIR%"
echo.

:: ═══════════════════════════════════════════════════════════════
::  SETUP GLOBAL COMMAND
:: ═══════════════════════════════════════════════════════════════

echo    ─────────────────────────────────────────────────────
echo    Setting up global "anakot" command...
echo.

set "BIN_DIR=%USERPROFILE%\.anakot\bin"
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

(
echo @echo off
echo set "ANAKOT_HOME=%USERPROFILE%\.anakot"
echo set "PYTHONUTF8=1"
echo "%INSTALL_DIR%\venv\Scripts\python.exe" -m anakot_cli.main %%*
) > "%BIN_DIR%\anakot.bat"

:: Add to User PATH
set "USER_PATH="
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul ^| findstr /i "Path"') do set "USER_PATH=%%b"

echo %USER_PATH% | findstr /i "%BIN_DIR%" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if defined USER_PATH (
        setx PATH "%BIN_DIR%;%USER_PATH%" >nul 2>&1
    ) else (
        setx PATH "%BIN_DIR%" >nul 2>&1
    )
    echo    ✔ Added to PATH: %BIN_DIR%
) else (
    echo    ✔ Already on PATH.
)

setx ANAKOT_HOME "%USERPROFILE%\.anakot" >nul 2>&1

:: Create data directories
if not exist "%USERPROFILE%\.anakot" mkdir "%USERPROFILE%\.anakot"
if not exist "%USERPROFILE%\.anakot\skills" mkdir "%USERPROFILE%\.anakot\skills"
if not exist "%USERPROFILE%\.anakot\sessions" mkdir "%USERPROFILE%\.anakot\sessions"
if not exist "%USERPROFILE%\.anakot\logs" mkdir "%USERPROFILE%\.anakot\logs"
if not exist "%USERPROFILE%\.anakot\cron" mkdir "%USERPROFILE%\.anakot\cron"

:: Copy bundled skills
if exist "%INSTALL_DIR%\skills" (
    xcopy /E /I /Y "%INSTALL_DIR%\skills\*" "%USERPROFILE%\.anakot\skills\" >nul 2>&1
    echo    ✔ Bundled skills installed.
)

:: Copy config template
if not exist "%USERPROFILE%\.anakot\config.yaml" (
    if exist "%INSTALL_DIR%\cli-config.yaml.example" (
        copy "%INSTALL_DIR%\cli-config.yaml.example" "%USERPROFILE%\.anakot\config.yaml" >nul 2>&1
    )
)

echo.

:: ═══════════════════════════════════════════════════════════════
::  VERIFY
:: ═══════════════════════════════════════════════════════════════

echo    ─────────────────────────────────────────────────────
echo    Verifying installation...
echo.

"%INSTALL_DIR%\venv\Scripts\python.exe" -c "import anakot_cli.main; print('OK')" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    ✔ Backend: Working
) else (
    echo    ⚠ Backend: Import test failed.
)

if exist "%INSTALL_DIR%\ui-tui\dist\entry.js" (
    echo    ✔ TUI: Built
) else (
    echo    ⚠ TUI: Not built. Use --cli mode.
)

:: ═══════════════════════════════════════════════════════════════
::  DONE
:: ═══════════════════════════════════════════════════════════════

echo.
echo.
echo         ╔═══════════════════════════════════════════════╗
echo         ║         I N S T A L L A T I O N   D O N E       ║
echo         ╚═══════════════════════════════════════════════╝
echo.
echo              Install:  %INSTALL_DIR%
echo              Data:     %USERPROFILE%\.anakot
echo.
echo         ┌─────────────────────────────────────────────┐
echo         │  NEXT STEPS:                                │
echo         │                                             │
echo         │  1. RESTART your terminal                   │
echo         │  2. Run:  anakot setup                      │
echo         │  3. Run:  anakot --tui                      │
echo         │  4. Or launch "Anakot Agent" from Desktop    │
echo         └─────────────────────────────────────────────┘
echo.

set /p "RUN_SETUP=         Run setup wizard now? [Y/n]: "
if /i "%RUN_SETUP%"=="n" (
    echo.
    echo         Done! Restart terminal, then: anakot setup
    echo.
    pause
    exit /b 0
)

echo.
echo         Launching setup wizard...
echo.
"%INSTALL_DIR%\venv\Scripts\python.exe" -m anakot_cli.main setup

echo.
echo         All done! Restart terminal, then: anakot --tui
echo.
pause
