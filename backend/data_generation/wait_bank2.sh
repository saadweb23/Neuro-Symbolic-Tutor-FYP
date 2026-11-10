#!/bin/bash
cd "E:\Sohaib Uni Material\FYP\neuro_symbolic_tutor\backend"
while tasklist //FI "PID eq 7760" 2>/dev/null | grep -q 7760; do
  sleep 45
done
echo "=== PROCESS EXITED ==="
tail -c 2500 data_generation/build_bank_run.log
