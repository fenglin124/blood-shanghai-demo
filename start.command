#!/bin/bash
cd "$(dirname "$0")"
(sleep 1; open "http://127.0.0.1:8082") &
exec python3 -m http.server 8082 --bind 127.0.0.1