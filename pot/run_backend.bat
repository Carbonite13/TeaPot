@echo off
cd /d "%~dp0"
set "PYTHON312=C:\Users\Admin\AppData\Local\Programs\Python\Python312\python.exe"

if exist "%PYTHON312%" (
    echo [1/3] Binding Poetry to official Python 3.12: %PYTHON312%
    poetry env use "%PYTHON312%"
)

echo [2/3] Installing dependencies...
poetry install

set "CREWAI_STORAGE_DIR=%~dp0data\runtime\crewai"
set "LOCALAPPDATA=%~dp0data\runtime"

echo [3/3] Starting DUK Slice Advisor on http://localhost:8000...
poetry run uvicorn duk.main:app --port 8000 --reload
pause
