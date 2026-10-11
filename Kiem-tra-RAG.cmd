@echo off
setlocal
cd /d "%~dp0"
title DENSO - Kiem tra Gemini va Vector RAG
echo Kiem tra embedding, vector va cau tra loi Gemini that.
echo Hay dien GEMINI_API_KEY trong .env truoc khi chay.
echo Lenh nay gui tai lieu demo den Gemini va su dung han muc API.
set "DEMO_PY=py"
if exist ".venv\Scripts\python.exe" set "DEMO_PY=%~dp0.venv\Scripts\python.exe"
"%DEMO_PY%" -m backend.rag.check
if errorlevel 1 (
  echo.
  echo CHUA DAT. Xem thong bao loi phia tren. Khong chia se API key.
) else (
  echo.
  echo DA DAT: embedding, tim kiem vector va Gemini da goi thanh cong.
  echo Neu vua doi .env, dung may chu cu bang Ctrl+C va chay lai Chay-demo.cmd.
)
pause
