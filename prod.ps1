param (
    [switch]$Rebuild
)

# Function to stop all child processes
function Stop-Services {
    Write-Host "Shutting down services..."
    Get-Job | Stop-Job
    Get-Job | Remove-Job
}

# Register cleanup on exit
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -SupportEvent -Action {
    Stop-Services
}

try {
    if ((-not $Rebuild) -and (Test-Path ".\backend\target\release\backend.exe") -and (Test-Path ".\frontend\dist")) {
        Write-Host "Build artifacts found. Skipping build..."
    } else {
        if ($Rebuild) {
            Write-Host "Rebuild requested..."
        } else {
            Write-Host "Build artifacts missing. Building..."
        }

        Write-Host "Building Backend (Release)..."
        Push-Location backend
        cargo build --release
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Backend build failed!"
            Pop-Location
            exit 1
        }
        Pop-Location

        Write-Host "Building Frontend..."
        Push-Location frontend
        bun run build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Frontend build failed!"
            Pop-Location
            exit 1
        }
        Pop-Location
    }

    Write-Host "Starting Backend Server (Release)..."
    # Start backend in a new process/job
    $backendProcess = Start-Process -FilePath ".\backend\target\release\backend.exe" -PassThru

    Write-Host "Waiting for backend to initialize..."
    Start-Sleep -Seconds 2

    Write-Host "Starting Frontend (Preview)..."
    Push-Location frontend
    # Start frontend preview
    $frontendProcess = Start-Process -FilePath "bun" -ArgumentList "run", "preview" -PassThru
    Pop-Location

    Write-Host "Services are running."
    Write-Host "Backend PID: $($backendProcess.Id)"
    Write-Host "Frontend PID: $($frontendProcess.Id)"
    Write-Host "Press any key to stop..."
    
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
finally {
    Stop-Services
    if ($backendProcess) { Stop-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue }
    if ($frontendProcess) { Stop-Process -Id $frontendProcess.Id -ErrorAction SilentlyContinue }
}
