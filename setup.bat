@echo off
echo ========================================
echo    Easy Scraper Clone - Quick Setup
echo ========================================
echo.

echo [1/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/4] Building extension...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Failed to build extension
    pause
    exit /b 1
)

echo.
echo [3/4] Extension built successfully!
echo.
echo [4/4] Installation instructions:
echo.
echo 1. Open Chrome browser
echo 2. Go to chrome://extensions/
echo 3. Enable "Developer mode"
echo 4. Click "Load unpacked"
echo 5. Select the "dist" folder
echo.
echo ========================================
echo    Setup Complete! 🎉
echo ========================================
echo.
echo The extension is ready to use!
echo Press any key to exit...
pause >nul
