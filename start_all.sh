#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "\033[36mStarting QuriousBit Games Ecosystem...\033[0m"

# 1. Start Codewords Python Backend
echo -e "\033[33mStarting Codewords backend...\033[0m"
cd "$SCRIPT_DIR/codewords"
python3 combined_service.py &
P1=$!

# 2. Start Word Association React App
echo -e "\033[33mStarting Word Association React App...\033[0m"
cd "$SCRIPT_DIR/debug_app"
npm run dev &
P2=$!

# 3. Start Launcher Server
echo -e "\033[33mStarting Unified Launcher on localhost:3000...\033[0m"
cd "$SCRIPT_DIR"
python3 -m http.server 3000 &
P3=$!

echo -e "\033[90mWaiting 3 seconds for servers to initialize...\033[0m"
sleep 3

# 4. Open the Launcher
echo -e "\033[32mOpening Unified Launcher...\033[0m"
open http://localhost:3000

echo -e "\033[36mAll systems go! Press Ctrl+C or close this terminal to stop all servers.\033[0m"

# Wait and clean up on exit
cleanup() {
    echo -e "\033[33mStopping servers...\033[0m"
    kill $P1 $P2 $P3 2>/dev/null || true
    echo -e "\033[32mAll servers stopped.\033[0m"
}
trap cleanup EXIT INT TERM

# Keep script running
wait
