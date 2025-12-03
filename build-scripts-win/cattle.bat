@echo off
echo Starting Cattle production build...
powershell -ExecutionPolicy Bypass -File "%~dp0build-cattle.ps1"
pause

