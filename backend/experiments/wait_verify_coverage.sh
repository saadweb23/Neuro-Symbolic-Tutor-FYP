#!/bin/bash
cd "E:\Sohaib Uni Material\FYP\neuro_symbolic_tutor\backend"
while tasklist //FI "PID eq 12664" 2>/dev/null | grep -q 12664; do
  sleep 15
done
echo "=== PROCESS EXITED ==="
tail -c 3000 experiments/logs/verify_coverage_retrain.log
