# PowerShell script for Cattle Production Build
# This script builds the React app and copies files to cattle-build directory for WinSCP upload

Write-Host "Starting Cattle Production Build..." -ForegroundColor Green

# Get the current directory (should be the project root)
$projectRoot = Get-Location
$dormMartPath = Join-Path $projectRoot "dorm-mart"
$cattleBuildPath = "C:\xampp\htdocs\cattle-build"

Write-Host "Building React app for production..." -ForegroundColor Cyan
# Change to dorm-mart directory and build
Set-Location $dormMartPath
npm run build-cattle-win

Write-Host "Creating cattle-build directory..." -ForegroundColor Yellow
# Create cattle-build directory if it doesn't exist
if (!(Test-Path $cattleBuildPath)) {
    New-Item -ItemType Directory -Path $cattleBuildPath -Force
} else {
    # Clear existing directory
    Remove-Item -Path "$cattleBuildPath\*" -Recurse -Force
    Write-Host "Cleared existing cattle-build directory" -ForegroundColor Yellow
}

Write-Host "Copying files to cattle-build directory..." -ForegroundColor Yellow

# Copy API folder
Write-Host "Copying api folder..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\api" -Destination $cattleBuildPath -Recurse -Force

# Copy data folder
Write-Host "Copying data folder..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\data" -Destination $cattleBuildPath -Recurse -Force

# Copy migrations folder
Write-Host "Copying migrations folder..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\migrations" -Destination $cattleBuildPath -Recurse -Force

# Copy vendor folder
Write-Host "Copying vendor folder..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\vendor" -Destination $cattleBuildPath -Recurse -Force

# Copy .env.cattle file
Write-Host "Copying .env.cattle file..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\.env.cattle" -Destination $cattleBuildPath -Force

# Copy build contents (not the build folder itself)
Write-Host "Copying build contents..." -ForegroundColor Cyan
$buildPath = Join-Path $dormMartPath "build"
if (Test-Path $buildPath) {
    Get-ChildItem -Path $buildPath | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $cattleBuildPath -Recurse -Force
    }
    Write-Host "Build contents copied successfully!" -ForegroundColor Green
} else {
    Write-Host "Warning: Build folder not found. Make sure the build completed successfully." -ForegroundColor Red
}

Write-Host "Cattle Production Build completed!" -ForegroundColor Green
Write-Host "All files are ready in: C:\xampp\htdocs\cattle-build" -ForegroundColor Yellow
Write-Host "You can now upload this entire folder to Cattle using WinSCP" -ForegroundColor Cyan
Write-Host "Don't forget to run migrations on the server after upload!" -ForegroundColor Red

