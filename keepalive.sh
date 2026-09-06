#!/bin/bash
# Keepalive wrapper — runs next dev with limited heap and restarts on exit.
#
# IMPORTANT: SKIP_LLM=1 means every prediction is a deterministic heuristic
# fallback, not a live LLM call. Recordings of this process MUST be labelled
# “Deterministic fallback demo.” Unset SKIP_LLM (and provide z-ai credentials)
# for a verified LLM-backed run.
cd /home/z/my-project
export SKIP_LLM="${SKIP_LLM:-1}"
export DEMO_DISAGREE=1
export NODE_OPTIONS="--max-old-space-size=768"
while true; do
  echo "[keepalive $(date +%H:%M:%S)] starting next dev (webpack, 768MB heap, SKIP_LLM=${SKIP_LLM})..."
  npx next dev -p 3000 --webpack >> /tmp/next.log 2>&1
  EXIT=$?
  echo "[keepalive $(date +%H:%M:%S)] next dev exited ($EXIT) — restarting in 3s" >> /tmp/next.log 2>&1
  # clean up any orphaned next-server
  pkill -f "next-server" 2>/dev/null
  pkill -f "next/dist/bin/next" 2>/dev/null
  sleep 3
done
