#!/bin/bash
cd "E:\Sohaib Uni Material\FYP\neuro_symbolic_tutor\backend"
while tasklist //FI "PID eq 13860" 2>/dev/null | grep -q 13860; do
  sleep 15
done
echo "=== PROCESS EXITED ==="
tail -c 3000 experiments/logs/check_deterministic.log
