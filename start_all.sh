#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Kill any leftover processes on the ports we need
echo -e "\033[0;90mCleaning up any existing processes on ports 3000, 5173, 8080...\033[0m"
for PORT in 3000 5173 8080; do
    PIDS=$(lsof -ti tcp:$PORT 2>/dev/null) || true
    if [ -n "$PIDS" ]; then
        echo -e "\033[0;90m  Killing process(es) on port $PORT: $PIDS\033[0m"
        echo "$PIDS" | xargs kill -9 2>/dev/null || true
    fi
done
sleep 1

echo -e "\033[0;36mStarting QuriousBit Games Ecosystem...\033[0m"

# 1. Start Codewords Python Backend
echo -e "\033[0;33mStarting Codewords backend...\033[0m"
cd "$SCRIPT_DIR/codewords"
PYTHON="$SCRIPT_DIR/codewords/.venv/bin/python3"
if [ ! -f "$PYTHON" ]; then
    echo -e "\033[0;31mVenv not found. Run: python3 -m venv codewords/.venv && codewords/.venv/bin/pip install -r codewords/requirements.txt\033[0m"
    exit 1
fi
"$PYTHON" combined_service.py &
P1=$!

# 2. Start Word Association React App
echo -e "\033[0;33mStarting Word Association dev app...\033[0m"
cd "$SCRIPT_DIR/debug_app"
npm run dev &
P2=$!

# 3. Start Launcher Server
echo -e "\033[0;33mStarting Unified Launcher on localhost:3000...\033[0m"
cd "$SCRIPT_DIR"
python3 -m http.server 3000 &
P3=$!

echo -e "\033[0;90mWaiting 3 seconds for servers to initialize...\033[0m"
sleep 3

# 4. Open the Launcher
echo -e "\033[0;32mOpening Unified Launcher...\033[0m"
open "http://localhost:3000"

echo -e "\033[0;36m========================================================\033[0m"
echo -e "\033[0;32mAll systems go! The servers are now running in the background.\033[0m"
echo -e "\033[0;32mYou can now use the website at http://localhost:3000\033[0m"
echo -e "\033[0;36m========================================================\033[0m"
echo ""
read -r -p "PRESS ENTER IN THIS WINDOW WHEN YOU WANT TO SHUT DOWN THE SERVERS"

echo -e "\033[0;33mStopping servers...\033[0m"
kill "$P1" "$P2" "$P3" 2>/dev/null || true
wait "$P1" "$P2" "$P3" 2>/dev/null || true
echo -e "\033[0;32mAll servers stopped.\033[0m"
