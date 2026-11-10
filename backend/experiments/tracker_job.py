"""Trains ONE tracker configuration and saves its checkpoint, predictions and
a JSON summary under experiments/results/tracker_v2/runs/.

Model selection is by validation AUC only. Test-set numbers are recorded for
reporting but never used to choose epochs, hyperparameters or variants.

    python experiments/tracker_job.py --name A_global --variant global --seed 0
"""
import argparse
import json
import os
import sys
import time

import numpy as np
import torch
from sklearn.metrics import roc_auc_score

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tracker import fast_train as ft
from tracker.dual_gcn import DualGCNTracker

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BACKEND, "data_generation")
EXTRA = os.path.join(DATA, "extra")
RUNS = os.path.join(BACKEND, "experiments", "results", "tracker_v2", "runs")

VARIANTS = {
    "original": {},
    "logtime": {"use_log_time": True},
    "global": {"use_global_state": True},
    "global_logtime": {"use_global_state": True, "use_log_time": True},
}


def load_dataset(key, extra_n):
    """Returns (train, val, {test_name: test_data})."""
    if key in ("orig", "orig_extra"):
        data = ft.load_sequences(f"{DATA}/generated_logs.csv", f"{DATA}/generated_logs_oracle.csv")
        tr, va, te = ft.original_split(len(data["nodes"]))
        train, val, test = ft.take(data, tr), ft.take(data, va), ft.take(data, te)
        if key == "orig_extra" and extra_n:
            more = ft.load_sequences(f"{EXTRA}/train_extra.csv", f"{EXTRA}/train_extra_oracle.csv")
            train = ft.concat(train, ft.take(more, np.arange(extra_n)))
        fresh = ft.load_sequences(f"{EXTRA}/fresh_test.csv", f"{EXTRA}/fresh_test_oracle.csv")
        return train, val, {"orig_test": test, "fresh_test": fresh}
    data = ft.load_sequences(f"{EXTRA}/{key}.csv", f"{EXTRA}/{key}_oracle.csv")
    tr, va, te = ft.original_split(len(data["nodes"]), val_frac=1 / 6, test_frac=1 / 6)
    return ft.take(data, tr), ft.take(data, va), {"test": ft.take(data, te)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--variant", default="original", choices=VARIANTS)
    ap.add_argument("--data", default="orig")
    ap.add_argument("--extra-n", type=int, default=0)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--patience", type=int, default=4)
    ap.add_argument("--bs", type=int, default=64)
    ap.add_argument("--lr", type=float, default=2e-3)
    ap.add_argument("--dropout", type=float, default=0.1)
    ap.add_argument("--hidden", type=int, default=64)
    ap.add_argument("--threads", type=int, default=2)
    ap.add_argument("--no-graph", action="store_true",
                    help="ablation: remove every prerequisite edge, so each concept's memory is updated "
                         "only by its own answers (the global learner state still works)")
    args = ap.parse_args()

    torch.set_num_threads(args.threads)
    os.makedirs(RUNS, exist_ok=True)
    edge_index = torch.zeros(2, 0, dtype=torch.long) if args.no_graph else ft.get_edge_index()
    train, val, tests = load_dataset(args.data, args.extra_n)
    print(f"[{args.name}] variant={args.variant} data={args.data} train={len(train['nodes'])} "
          f"val={len(val['nodes'])} seed={args.seed}", flush=True)

    ft.set_seed(args.seed)
    model = DualGCNTracker(25, args.hidden, args.hidden, dropout=args.dropout, **VARIANTS[args.variant])
    t0 = time.time()
    state, info = ft.train(model, train, val, edge_index, epochs=args.epochs, batch_size=args.bs,
                           lr=args.lr, patience=args.patience, seed=args.seed,
                           log=lambda s: print(f"[{args.name}] {s.strip()}", flush=True))
    minutes = (time.time() - t0) / 60
    model.load_state_dict(state)

    logits = {"val": ft.predict_logits(model, val, edge_index)}
    result = {
        "name": args.name, "variant": args.variant + ("_nograph" if args.no_graph else ""),
        "data": args.data, "seed": args.seed,
        "extra_n": args.extra_n, "train_students": int(len(train["nodes"])),
        "best_epoch": info["best_epoch"], "best_val_auc": info["best_val_auc"],
        "epochs_run": len(info["history"]), "train_minutes": minutes, "history": info["history"],
        "val_oracle_auc": float(roc_auc_score(val["passed"].numpy().ravel(), val["oracle"].ravel())),
        "args": vars(args), "test": {},
    }
    for name, d in tests.items():
        logits[name] = ft.predict_logits(model, d, edge_index)
        y = d["passed"].numpy()
        result["test"][name] = {
            "auc": ft.pooled_auc(y, logits[name]),
            "oracle_auc": float(roc_auc_score(y.ravel(), d["oracle"].ravel())),
            "students": int(len(y)),
        }

    torch.save({"model_state_dict": state, "config": model.config(), "epoch": info["best_epoch"],
                "val_auc": info["best_val_auc"]}, os.path.join(RUNS, f"{args.name}.pth"))
    np.savez_compressed(os.path.join(RUNS, f"{args.name}_logits.npz"),
                        **{k: v.astype(np.float32) for k, v in logits.items()})
    with open(os.path.join(RUNS, f"{args.name}.json"), "w") as f:
        json.dump(result, f, indent=2)
    print(f"[{args.name}] DONE best val AUC {info['best_val_auc']:.4f} @ epoch {info['best_epoch']} "
          f"({minutes:.1f} min) | test: " +
          ", ".join(f"{k}={v['auc']:.4f} (oracle {v['oracle_auc']:.4f})" for k, v in result["test"].items()),
          flush=True)


if __name__ == "__main__":
    main()
