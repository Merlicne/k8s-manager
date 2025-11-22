# check for cargo
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Error "Cargo is not installed. Please install Rust and Cargo from https://www.rust-lang.org/tools/install"
    exit 1
}
# check for bun if not installed check for npm
$TS_COMMAND = "bun"
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Error "Bun or npm is not installed. Please install Bun from https://bun.sh/ or Node.js from https://nodejs.org/"
        exit 1
    } else {
        Write-Host "Bun not found, but npm is available. Proceeding with npm."
        $TS_COMMAND = "npm"
    }
} else {
    Write-Host "Bun is installed."
}


# dev.ps1 - Run both services in new windows
Write-Host "Starting Backend Server..."
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd backend; cargo run"

Write-Host "Starting Frontend Application..."
# install dependencies if node_modules does not exist
if (-not (Test-Path -Path "frontend/node_modules")) {
    Write-Host "Installing frontend dependencies..."
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd frontend; $TS_COMMAND install" -Wait
}
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd frontend; $TS_COMMAND run dev"

Write-Host "Services started in separate windows."
