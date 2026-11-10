"""Batched training/evaluation loops for DualGCNTracker.

train_tracker.py updates the model once per student (batch size 1, ~10 min
per epoch on CPU). Here B students are advanced in lockstep through
DualGCNTracker.forward_batch, which is numerically identical to the
one-at-a-time path but orders of magnitude faster, so ablations and
multi-seed runs become practical.

Every step t is predicted from the state BEFORE step t's own outcome is
revealed (no lookahead), exactly as in train_tracker.run_sequence.
"""
import random

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import roc_auc_score
from torch_geometric.utils import from_networkx

from knowledge_graph.graph_builder import CONCEPT_TO_ID, build_python_dag

MAX_TIME = 180.0


def set_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def get_edge_index():
    return from_networkx(build_python_dag()).edge_index


def load_sequences(csv_path, oracle_path=None):
    """Loads a simulated-student CSV into aligned arrays of shape [students, steps]."""
    df = pd.read_csv(csv_path).sort_values(["student_id", "step"])
    n = df["student_id"].nunique()
    steps = len(df) // n
    assert steps * n == len(df), "every student must have the same number of steps"
    data = {
        "student_ids": df["student_id"].values.reshape(n, steps)[:, 0],
        "nodes": torch.tensor(df["concept"].map(CONCEPT_TO_ID).values.reshape(n, steps), dtype=torch.long),
        "passed": torch.tensor(df["passed"].values.reshape(n, steps), dtype=torch.float32),
        "seconds": torch.tensor(df["time_taken"].values.reshape(n, steps), dtype=torch.float32),
    }
    data["time"] = torch.clamp(data["seconds"] / MAX_TIME, max=1.0)
    if oracle_path is not None:
        orc = pd.read_csv(oracle_path).sort_values(["student_id", "step"])
        data["oracle"] = orc["true_pass_prob"].values.reshape(n, steps)
    return data


def original_split(n, val_frac=0.10, test_frac=0.10, seed=42):
    """Index split identical to train_tracker.split_dataset, so results stay
    comparable with the originally reported numbers."""
    idx = np.arange(n)
    np.random.RandomState(seed).shuffle(idx)
    n_val, n_test = int(n * val_frac), int(n * test_frac)
    return idx[n_val + n_test:], idx[:n_val], idx[n_val:n_val + n_test]


def take(data, idx):
    idx_t = torch.as_tensor(np.asarray(idx))
    out = {}
    for k, v in data.items():
        if isinstance(v, torch.Tensor):
            out[k] = v[idx_t]
        elif isinstance(v, np.ndarray):
            out[k] = v[np.asarray(idx)]
    return out


def concat(a, b):
    out = {}
    for k in a:
        if k in b:
            out[k] = torch.cat([a[k], b[k]]) if isinstance(a[k], torch.Tensor) else np.concatenate([a[k], b[k]])
    return out


@torch.no_grad()
def predict_logits(model, data, edge_index, batch_size=500):
    """Raw (offset-free) logits, shape [students, steps], from a no-lookahead rollout."""
    model.eval()
    n, steps = data["nodes"].shape
    out = np.zeros((n, steps), dtype=np.float64)
    for start in range(0, n, batch_size):
        sl = slice(start, min(start + batch_size, n))
        nodes, passed, time = data["nodes"][sl], data["passed"][sl], data["time"][sl]
        h = model.init_state(batch_size=nodes.shape[0])
        for t in range(steps):
            out[sl, t] = model.predict_batch(h, nodes[:, t], apply_offset=False).numpy()
            h = model.forward_batch(edge_index, nodes[:, t], passed[:, t], time[:, t], h)
    return out


def pooled_auc(y, logits):
    return float(roc_auc_score(np.asarray(y).ravel(), np.asarray(logits).ravel()))


def train(model, train_data, val_data, edge_index, *, epochs=30, batch_size=64, lr=2e-3,
          weight_decay=1e-4, grad_clip=1.0, pos_weight=None, patience=8, seed=0, log=print):
    """Trains with BCE, selects the epoch with the best VALIDATION AUC.
    Returns (best_state_dict, info)."""
    set_seed(seed)
    criterion = nn.BCEWithLogitsLoss(
        pos_weight=None if pos_weight is None else torch.tensor([float(pos_weight)]))
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    n, steps = train_data["nodes"].shape
    best_auc, best_epoch, best_state, stale = -1.0, 0, None, 0
    history = []

    for epoch in range(1, epochs + 1):
        model.train()
        order = torch.randperm(n)
        total = 0.0
        for start in range(0, n, batch_size):
            ids = order[start:start + batch_size]
            nodes, passed, time = train_data["nodes"][ids], train_data["passed"][ids], train_data["time"][ids]
            h = model.init_state(batch_size=len(ids))
            loss = 0.0
            for t in range(steps):
                logit = model.predict_batch(h, nodes[:, t], apply_offset=False)
                loss = loss + criterion(logit, passed[:, t])
                h = model.forward_batch(edge_index, nodes[:, t], passed[:, t], time[:, t], h)
            loss = loss / steps
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), grad_clip)
            optimizer.step()
            total += loss.item() * len(ids)
        scheduler.step()

        val_auc = pooled_auc(val_data["passed"], predict_logits(model, val_data, edge_index))
        history.append({"epoch": epoch, "train_loss": total / n, "val_auc": val_auc})
        log(f"  epoch {epoch:02d}/{epochs} | train BCE {total / n:.4f} | val AUC {val_auc:.4f}")

        if val_auc > best_auc:
            best_auc, best_epoch, stale = val_auc, epoch, 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            stale += 1
            if stale >= patience:
                log(f"  early stop (no val improvement for {patience} epochs)")
                break

    return best_state, {"best_val_auc": best_auc, "best_epoch": best_epoch, "history": history}
