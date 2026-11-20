@echo off
setlocal EnableExtensions
chcp 65001 >nul
title GAMEPICK STUDIO - Launcher
cd /d "%~dp0"

echo ===================================================
echo                 GAMEPICK STUDIO
echo ===================================================
echo.
if not exist "app.py" goto incomplete
if not exist "static\index.html" goto incomplete

set "SYSTEM_PY="
where py >nul 2>&1
if not errorlevel 1 (
    py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1
    if not errorlevel 1 set "SYSTEM_PY=py -3"
)
if not defined SYSTEM_PY (
    python -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1
    if not errorlevel 1 set "SYSTEM_PY=python"
)
if not defined SYSTEM_PY goto no_python

if not exist ".venv\Scripts\python.exe" (
    echo [1/3] Setting up Python environment...
    %SYSTEM_PY% -m venv ".venv"
    if errorlevel 1 goto venv_error
)
set "RUN_PY=%CD%\.venv\Scripts\python.exe"
"%RUN_PY%" -c "import fastapi,uvicorn,requests,bs4" >nul 2>&1
if errorlevel 1 (
    echo [2/3] Installing necessary packages. Internet required once...
    echo Installation log: gamepick-install.log
    "%RUN_PY%" -m pip --disable-pip-version-check install -r "requirements.txt" > "gamepick-install.log" 2>&1
    if errorlevel 1 goto install_error
) else (
    echo [2/3] Dependencies already installed.
)

echo [3/3] Launching browser and local server...
echo.
"%RUN_PY%" "launcher.py"
if errorlevel 1 goto server_error

echo.
echo GAMEPICK is stopped.
pause
exit /b 0

:incomplete
echo ERROR: Project files are missing!
echo Right-click ZIP ^> Extract All; run start_windows.bat from the extracted GAMEPICK_STUDIO folder.
goto failed
:no_python
echo ERROR: Python 3.10 or newer is not installed or not available.
echo Download Python from: https://www.python.org/downloads/windows/
echo During installation, enable: Add Python to PATH
echo Then run start_windows.bat again.
goto failed
:venv_error
echo ERROR: Could not create .venv environment.
echo Check folder permissions and free disk space.
goto failed
:install_error
echo ERROR: Cannot install Python packages.
echo Check your internet connection and open gamepick-install.log for details.
goto failed
:server_error
echo ERROR: Server failed. Open gamepick-startup.log to see what happened.
goto failed
:failed
echo.
echo Take a screenshot of this window or send the corresponding log.
pause
exit /b 1
