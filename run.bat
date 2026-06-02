@echo off
title SliceOptima Launcher
color 0B
cls

echo =========================================================
echo               SLICOPTIMA LAUNCHER 🍕
echo =========================================================
echo.
:: Auto-detect user's Python path to bypass Windows Store alias
set PYTHON_EXE=python
if exist "%USERPROFILE%\AppData\Local\Programs\Python\Python314\python.exe" (
    set PYTHON_EXE="%USERPROFILE%\AppData\Local\Programs\Python\Python314\python.exe"
)

echo [+] Verificando ambiente de execucao...

:: Check Python
%PYTHON_EXE% --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python nao encontrado! Certifique-se de que o Python esta instalado e no PATH.
    pause
    exit /b 1
)

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js nao encontrado! Certifique-se de que o Node.js esta instalado e no PATH.
    pause
    exit /b 1
)

echo [+] Instalando dependencias do backend (Python Flask/CORS)...
%PYTHON_EXE% -m pip install -r backend/requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Falha ao instalar dependencias do Python.
    pause
    exit /b 1
)

echo [+] Instalando dependencias do frontend (Vue/Chart.js)...
if not exist "frontend\node_modules\" (
    cd frontend
    call npm install
    cd ..
) else (
    echo [~] Dependencias do frontend ja instaladas, pulando...
)

echo.
echo =========================================================
echo [+] Iniciando Servidores...
echo =========================================================
echo.

:: Launch backend in a separate window
echo [+] Iniciando backend Flask na porta 5000...
start "SliceOptima Backend" cmd /c "%PYTHON_EXE% backend/app.py"

:: Give backend 1.5 seconds to bind to port
timeout /t 2 /nobreak >nul

:: Launch frontend in a separate window
echo [+] Iniciando frontend Vite na porta 5173...
cd frontend
start "SliceOptima Frontend" cmd /c "npm run dev"
cd ..

:: Open browser
echo [+] Abrindo o navegador...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo [*] Pronto! SliceOptima esta rodando.
echo [!] Para fechar o programa, feche as janelas abertas do terminal.
echo =========================================================
echo.
pause
