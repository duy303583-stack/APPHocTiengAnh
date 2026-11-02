@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === EngMate: cai thu vien (lan dau se mat mot chut thoi gian) ===
python -m pip install -q -r server\requirements.txt
if errorlevel 1 (
  echo Khong cai duoc thu vien. Hay chac chan da cai Python: https://www.python.org/downloads/
  pause
  exit /b 1
)
if "%ANTHROPIC_API_KEY%"=="" echo [Luu y] Chua dat ANTHROPIC_API_KEY: gia su AI tren may chu se tat. Co the nhap key trong app: Thanh tich - Cai dat.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:5000"
python server\app.py
pause
