#!/bin/bash
cd "E:\Sohaib Uni Material\FYP\neuro_symbolic_tutor\backend"
while tasklist //FI "PID eq 8932" 2>/dev/null | grep -q 8932; do
  sleep 30
done
echo "=== PROCESS EXITED ==="
tail -c 6000 experiments/logs/ppo_retrain_coverage_run.log
