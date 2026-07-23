#!/bin/bash
# Keepalive wrapper — runs next dev with limited heap and restarts on exit.
cd /home/z/my-project
export SKIP_LLM=1
export NODE_OPTIONS="--max-old-space-size=768"
while true; do
  echo "[keepalive $(date +%H:%M:%S)] starting next dev (webpack, 768MB heap)..."
  npx next dev -p 3000 --webpack >> /tmp/next.log 2>&1
  EXIT=$?
  echo "[keepalive $(date +%H:%M:%S)] next dev exited ($EXIT) — restarting in 3s" >> /tmp/next.log 2>&1
  # clean up any orphaned next-server
  pkill -f "next-server" 2>/dev/null
  pkill -f "next/dist/bin/next" 2>/dev/null
  sleep 3
done
