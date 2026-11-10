#!/bin/bash
cd "E:\Sohaib Uni Material\FYP\neuro_symbolic_tutor\backend"
while tasklist //FI "PID eq 8624" 2>/dev/null | grep -q 8624; do
  sleep 45
done
echo "=== PROCESS EXITED ==="
tail -c 2500 data_generation/build_bank_run.log
