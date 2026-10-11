@echo off
setlocal
cd /d "%~dp0"
title DENSO SmartMaint - Cai dat demo
if not exist ".venv\Scripts\python.exe" (
  py -m venv .venv
  if errorlevel 1 goto failed
)
".venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
if errorlevel 1 goto failed
".venv\Scripts\python.exe" -m backend.setup_demo
if errorlevel 1 goto failed
echo.
echo Da cai dat. Chay Chay-demo.cmd de mo ung dung.
pause
exit /b 0
:failed
echo.
echo Cai dat chua thanh cong. Xem loi phia tren.
echo Can Python voi Python Launcher [py], va Internet de tai thu vien.
pause
exit /b 1
