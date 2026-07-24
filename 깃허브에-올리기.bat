@echo off
cd /d "%~dp0"

echo ============================================
echo   Pushing to GitHub
echo   feast777/conti-share
echo ============================================
echo.
echo A GitHub login window may pop up.
echo Choose "Sign in with your browser" and approve.
echo.

git push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
  echo ============================================
  echo   SUCCESS - upload complete
  echo ============================================
) else (
  echo ============================================
  echo   FAILED - error code %ERRORLEVEL%
  echo   Copy the message above and send it to Claude.
  echo ============================================
)
echo.
pause
