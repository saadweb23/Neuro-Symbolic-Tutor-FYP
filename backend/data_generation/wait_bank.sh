#!/bin/bash
cd "E:\Sohaib Uni Material\FYP\neuro_symbolic_tutor\backend"
while tasklist //FI "PID eq 4644" 2>/dev/null | grep -q 4644; do
  sleep 30
done
echo "=== PROCESS EXITED ==="
tail -c 2000 data_generation/build_bank_run.log
