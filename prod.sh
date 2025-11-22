#!/bin/bash

FORCE_REBUILD=false

# Parse arguments
for arg in "$@"; do
    if [ "$arg" == "--rebuild" ]; then
        FORCE_REBUILD=true
        break
    fi
done

# Function to handle script termination
cleanup() {
    echo "Shutting down services..."
    kill $(jobs -p) 2>/dev/null
    exit
}

# Trap SIGINT (Ctrl+C) and call cleanup
trap cleanup SIGINT SIGTERM

if [ "$FORCE_REBUILD" = false ] && [ -f "./backend/target/release/backend" ] && [ -d "./frontend/dist" ]; then
    echo "Build artifacts found. Skipping build..."
else
    if [ "$FORCE_REBUILD" = true ]; then
        echo "Rebuild requested..."
    else
        echo "Build artifacts missing. Building..."
    fi

    echo "Building Backend (Release)..."
    (cd backend && cargo build --release)

    if [ $? -ne 0 ]; then
        echo "Backend build failed!"
        exit 1
    fi

    echo "Building Frontend..."
    (cd frontend && bun run build)

    if [ $? -ne 0 ]; then
        echo "Frontend build failed!"
        exit 1
    fi
fi

echo "Starting Backend Server (Release)..."
./backend/target/release/backend &

echo "Waiting for backend to initialize..."
sleep 2

echo "Starting Frontend (Preview)..."
(cd frontend && bun run preview) &

# Wait for all background processes to finish
wait
