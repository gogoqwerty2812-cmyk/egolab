@echo off
rem Double-click: shrinks data\content.json (moves embedded photos to assets\img\products)
cd /d "%~dp0.."
python tools\shrink-content.py %*
echo.
pause
