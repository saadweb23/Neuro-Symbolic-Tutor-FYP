"""Exports a trained v2 run as tracker/dual_gcn_weights_v2.pth (the live app keeps using
dual_gcn_weights.pth unless TRACKER_CHECKPOINT points at the v2 file).

The app's thresholds (tiers at 0.4/0.7, block completion at 0.65 average /
0.5 floor) and the PPO agent were built against the ORIGINAL model's belief
scale. The v2 model is more accurate and calibrated, but its raw probabilities
sit on a different scale (sharper, shifted). To keep the app's behaviour
stable, served beliefs are mapped onto the original scale by matching the mean
and spread of the logits on the VALIDATION students:

    served_logit = scale * raw_logit + offset

This is an increasing transform: ranking, AUC and every threshold-free metric
are unchanged. Evaluation (experiments/report_tracker_v2.py) always uses the
raw calibrated probabilities, never the rescaled ones.

    python tracker/export_production.py --run final_s1
"""
import argparse
import os
import sys

import numpy as np
import torch

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tracker import fast_train as ft
from tracker.dual_gcn import DualGCNTracker

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUNS = os.path.join(BACKEND, "experiments", "results", "tracker_v2", "runs")
V1 = os.path.join(BACKEND, "tracker", "dual_gcn_weights_v1.pth")
OUT = os.path.join(BACKEND, "tracker", "dual_gcn_weights_v2.pth")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="final_s1")
    args = ap.parse_args()

    D = os.path.join(BACKEND, "data_generation")
    data = ft.load_sequences(f"{D}/generated_logs.csv")
    _, va, _ = ft.original_split(len(data["nodes"]))
    val = ft.take(data, va)
    edge_index = ft.get_edge_index()

    v1 = DualGCNTracker(25, 64, 64)
    v1.load_state_dict(torch.load(V1, weights_only=False)["model_state_dict"])
    z1 = ft.predict_logits(v1, val, edge_index).ravel()

    ck = torch.load(os.path.join(RUNS, args.run + ".pth"), weights_only=False)
    z2 = np.load(os.path.join(RUNS, args.run + "_logits.npz"))["val"].ravel()

    scale = float(z1.std() / z2.std())
    offset = float(z1.mean() - scale * z2.mean())
    cfg = dict(ck["config"], belief_logit_scale=scale, belief_logit_offset=offset)

    model = DualGCNTracker.from_config(cfg)
    model.load_state_dict(ck["model_state_dict"])            # strict: config and weights must match
    torch.save({"model_state_dict": ck["model_state_dict"], "config": cfg, "epoch": ck["epoch"],
                "val_auc": ck["val_auc"], "source_run": args.run}, OUT)
    print(f"exported {args.run} -> {OUT}")
    print(f"  scale {scale:.4f}, offset {offset:.4f} (matches v1 logit mean {z1.mean():.3f} / std {z1.std():.3f} on validation)")


if __name__ == "__main__":
    main()
