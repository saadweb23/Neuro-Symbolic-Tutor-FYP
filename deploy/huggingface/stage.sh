#!/usr/bin/env bash
# Builds the Hugging Face Space repo contents (Dockerfile + README.md + backend/) in OUT (default build/hf-space).
# Research-only material (experiments, tests, raw datasets, training runs) is left out: the API does
# not import it, and a smaller upload builds faster.   Usage: bash deploy/huggingface/stage.sh [OUT]
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${1:-build/hf-space}"
rm -rf "$OUT"
mkdir -p "$OUT/backend"
cp deploy/huggingface/Dockerfile deploy/huggingface/README.md "$OUT/"
tar -C backend \
  --exclude='__pycache__' --exclude='*.pyc' --exclude='.env' --exclude='*.db' --exclude='*.db-*' \
  --exclude='./experiments' --exclude='./tests' --exclude='./scripts' --exclude='./knowledge_graph_physics' \
  --exclude='./agent/ppo_v2_runs' --exclude='./agent/checkpoints' \
  --exclude='./data_generation/*.csv' --exclude='./data_generation/*.log' --exclude='./data_generation/*.sh' \
  -cf - . | tar -C "$OUT/backend" -xf -
echo "Staged $(find "$OUT" -type f | wc -l) files, $(du -sh "$OUT" | cut -f1), in $OUT"
