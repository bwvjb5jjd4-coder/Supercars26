#!/bin/bash
# Double-click to play the game on this Mac. Close this window to stop it.
cd "$(dirname "$0")"
(sleep 1; open "http://localhost:8000/") &
python3 -m http.server 8000
