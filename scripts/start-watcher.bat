@echo off
REM start-watcher.bat
REM
REM Launches the folder watcher and automatically restarts it if it ever
REM exits unexpectedly (e.g. a crash, lost network connection mid-upload).
REM Designed to be run by Windows Task Scheduler at user logon / startup,
REM with "Run whether user is logged on or not" so it needs no one to be
REM signed in.
REM
REM This window stays hidden when launched via Task Scheduler (see
REM TASK_SCHEDULER_SETUP.md for the exact setup steps).

cd /d "%~dp0.."

:loop
echo [%date% %time%] Starting watcher... >> logs\watch.log
call npx tsx scripts\watch-upload.ts >> logs\watch.log 2>&1

echo [%date% %time%] Watcher exited unexpectedly. Restarting in 10 seconds... >> logs\watch.log
timeout /t 10 /nobreak > nul
goto loop