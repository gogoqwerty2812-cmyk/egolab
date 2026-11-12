@echo off
rem Double-click after every Export all:
rem   1) shrinks data\content.json (moves embedded photos to assets\img\products)
rem   2) rebuilds the SEO pages: product pages p\, articles blog\, sitemap.xml, llms.txt
cd /d "%~dp0.."
python tools\shrink-content.py %*
echo.
python tools\build-seo.py
echo.
pause
