@echo off
setlocal
cd /d "%~dp0"
title DENSO - Gemini Embedding / Vector Index
set "DEMO_PY=py"
if exist ".venv\Scripts\python.exe" set "DEMO_PY=%~dp0.venv\Scripts\python.exe"
"%DEMO_PY%" -m backend.rag.vectors
pause
