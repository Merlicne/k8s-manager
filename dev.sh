#! /bin/bash

# check if cargo is installed
if ! command -v cargo &> /dev/null
then
    echo "cargo could not be found, please install Rust and Cargo."
    exit
fi

TS_COMMAND="bun"
# check if bun is installed
if ! command -v bun &> /dev/null
then
    TS_COMMAND="npm"
    # check if npm is installed
    if ! command -v npm &> /dev/null
    then
        echo "Neither bun nor npm could be found, please install one of them."
        exit
    fi
fi

# Function to handle script termination
cleanup() {
    echo "Shutting down services..."
    kill $(jobs -p) 2>/dev/null
    exit
}

# Trap SIGINT (Ctrl+C) and call cleanup
trap cleanup SIGINT SIGTERM

echo "Starting Backend Server..."
(cd backend && cargo run) &

echo "Waiting for backend to initialize..."
sleep 2

echo "Starting Frontend Application..."
(cd frontend && $TS_COMMAND run dev) &

# Wait for all background processes to finish
wait
