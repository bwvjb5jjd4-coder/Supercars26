#!/bin/bash
# Double-click to play the game on this Mac. Close this window to stop it.
cd "$(dirname "$0")"
# Stop any game server left running from an earlier launch (or another copy of the game),
# otherwise the browser keeps getting the old files from it.
lsof -ti tcp:8000 -sTCP:LISTEN | xargs kill 2>/dev/null
sleep 1
(sleep 1; open "http://localhost:8000/?v=$(date +%s)") &
python3 -m http.server 8000
