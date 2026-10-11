@echo off
setlocal
cd /d "%~dp0"
title DENSO SmartMaint - Demo
echo Dang mo DENSO SmartMaint tai http://127.0.0.1:8001/
echo Giu cua so nay mo trong khi su dung. Nhan Ctrl+C de dung may chu.
set "DEMO_PY=py"
if exist ".venv\Scripts\python.exe" set "DEMO_PY=%~dp0.venv\Scripts\python.exe"
"%DEMO_PY%" -m backend.launch_demo
if errorlevel 1 (
  echo.
  echo Khong khoi dong duoc demo. Xem thong bao loi phia tren.
  echo Can Python va cac thu vien trong backend\requirements.txt.
  pause
)
