import os
import random

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.metrics import roc_auc_score, accuracy_score, f1_score
from torch.utils.data import Subset

from tracker.dual_gcn import DualGCNTracker
from tracker.graph_dataset import StudentGraphDataset
from knowledge_graph.graph_builder import build_python_dag

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, 'data_generation', 'generated_logs.csv')
CHECKPOINT_PATH = os.path.join(SCRIPT_DIR, 'tracker', 'dual_gcn_weights.pth')

SEED = 42
NUM_NODES = 25
FEATURE_DIM = 64
HIDDEN_DIM = 64
MAX_TIME = 180.0

EPOCHS = 25
LEARNING_RATE = 0.002
WEIGHT_DECAY = 1e-4
GRAD_CLIP_NORM = 1.0

VAL_FRAC = 0.10
TEST_FRAC = 0.10

STEPS_PER_STUDENT = 25
COLD_START_STEPS = 2  # steps 1-2 (0-indexed: 0, 1) are treated as cold-start


def set_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def split_dataset(dataset, val_frac, test_frac, seed):
    """Split by student (row index), not by interaction, so no student's
    steps appear in more than one split."""
    n = len(dataset)
    indices = np.arange(n)
    rng = np.random.RandomState(seed)
    rng.shuffle(indices)

    n_val = int(n * val_frac)
    n_test = int(n * test_frac)

    val_idx = indices[:n_val]
    test_idx = indices[n_val:n_val + n_test]
    train_idx = indices[n_val + n_test:]

    return (
        Subset(dataset, train_idx.tolist()),
        Subset(dataset, val_idx.tolist()),
        Subset(dataset, test_idx.tolist()),
    )


def compute_pos_weight(dataset, subset_indices, device):
    """pos_weight = failures / passes, computed from the TRAINING split only
    so validation/test class balance never leaks into the loss."""
    total_passed = 0
    total_steps = 0
    for idx in subset_indices:
        sequence, _ = dataset[idx]
        for step_data in sequence:
            total_passed += int(step_data['actual_outcome'].item())
            total_steps += 1

    pass_rate = total_passed / total_steps
    fail_rate = 1.0 - pass_rate
    weight = fail_rate / max(pass_rate, 1e-8)
    print(f"[pos_weight] train pass rate: {pass_rate:.2%} -> pos_weight={weight:.4f}")
    return torch.tensor([weight], device=device)


def safe_auc(y_true, y_score):
    try:
        return roc_auc_score(y_true, y_score)
    except ValueError:
        return float('nan')


def run_sequence(model, sequence, edge_index, device, criterion=None,
                  cold_start_weight=1.0, cold_start_steps=COLD_START_STEPS):
    """Runs one student's full trajectory. If `criterion` is given, returns
    the accumulated loss (with grad); otherwise returns per-step predictions
    with no grad. In both modes, step t is predicted from h_{t-1} BEFORE it
    is updated with step t's own outcome, so there is no lookahead leakage.

    `cold_start_weight` > 1.0 upweights the loss on the first
    `cold_start_steps` of each sequence -- diagnosed separately (see
    agent/tutoring_env.py) that cold-start belief is badly miscalibrated
    (AUC ~0.43-0.53 there vs ~0.72 steady-state), which let downstream
    policies get trapped mistaking an unmastered prerequisite for a
    satisfied one. Default 1.0 leaves ordinary training unaffected.
    """
    h_t = torch.zeros(model.num_nodes, model.hidden_dim, device=device)
    step_losses = []
    targets, probs = [], []

    for step_idx, step_data in enumerate(sequence):
        target_node = step_data['target_node']
        actual_outcome = step_data['actual_outcome'].to(device)
        passed = int(actual_outcome.item())
        norm_time = step_data['time_mask'][target_node].item()

        logit = model.predict_node(h_t, target_node)

        if criterion is not None:
            step_loss = criterion(logit.unsqueeze(0), actual_outcome.unsqueeze(0))
            if step_idx < cold_start_steps:
                step_loss = step_loss * cold_start_weight
            step_losses.append(step_loss)
        else:
            probs.append(torch.sigmoid(logit).item())
            targets.append(actual_outcome.item())

        h_t = model(edge_index, target_node, passed, norm_time, h_t)

    if criterion is not None:
        return torch.stack(step_losses).sum()
    return targets, probs


def train_one_epoch(model, train_subset, edge_index, optimizer, criterion, device, cold_start_weight=1.0):
    model.train()
    order = np.random.permutation(len(train_subset))
    total_loss = 0.0

    for i in order:
        sequence, _ = train_subset[int(i)]
        optimizer.zero_grad()

        student_loss = run_sequence(model, sequence, edge_index, device, criterion=criterion,
                                     cold_start_weight=cold_start_weight)
        student_loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=GRAD_CLIP_NORM)
        optimizer.step()

        total_loss += student_loss.item()

    return total_loss / len(train_subset) / STEPS_PER_STUDENT


@torch.no_grad()
def evaluate(model, subset, edge_index, device,
             steps_per_student=STEPS_PER_STUDENT, cold_start_steps=COLD_START_STEPS):
    """Warmed-state evaluation: reports overall metrics plus a cold-start
    slice (first `cold_start_steps`) and a steady-state slice (the rest),
    since early predictions are made from a near-empty memory state and
    are not representative of the tracker once it has warmed up."""
    model.eval()

    step_targets = {i: [] for i in range(steps_per_student)}
    step_probs = {i: [] for i in range(steps_per_student)}

    for i in range(len(subset)):
        sequence, _ = subset[i]
        targets, probs = run_sequence(model, sequence, edge_index, device, criterion=None)
        for step_idx, (t, p) in enumerate(zip(targets, probs)):
            step_targets[step_idx].append(t)
            step_probs[step_idx].append(p)

    all_targets = [t for step in step_targets.values() for t in step]
    all_probs = [p for step in step_probs.values() for p in step]

    cold_targets = [t for i in range(cold_start_steps) for t in step_targets[i]]
    cold_probs = [p for i in range(cold_start_steps) for p in step_probs[i]]

    steady_targets = [t for i in range(cold_start_steps, steps_per_student) for t in step_targets[i]]
    steady_probs = [p for i in range(cold_start_steps, steps_per_student) for p in step_probs[i]]

    binary_preds = [1 if p >= 0.5 else 0 for p in all_probs]

    return {
        'auc': float(safe_auc(all_targets, all_probs)),
        'acc': float(accuracy_score(all_targets, binary_preds)),
        'f1': float(f1_score(all_targets, binary_preds)),
        'cold_auc': float(safe_auc(cold_targets, cold_probs)),
        'steady_auc': float(safe_auc(steady_targets, steady_probs)),
    }


def main():
    set_seed(SEED)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Training on: {device}")
    if device.type == 'cuda':
        torch.backends.cudnn.benchmark = True

    # 1. Knowledge Graph & Dataset
    G = build_python_dag()
    dataset = StudentGraphDataset(csv_file=CSV_PATH, nx_graph=G, num_nodes=NUM_NODES, max_time=MAX_TIME)
    edge_index = dataset.edge_index.to(device)

    train_subset, val_subset, test_subset = split_dataset(dataset, VAL_FRAC, TEST_FRAC, SEED)
    print(f"Split sizes -> train: {len(train_subset)} | val: {len(val_subset)} | test: {len(test_subset)}")

    # 2. Model & Imbalance Handling (pos_weight from the training split only)
    model = DualGCNTracker(num_nodes=NUM_NODES, feature_dim=FEATURE_DIM, hidden_dim=HIDDEN_DIM).to(device)
    pos_weight = compute_pos_weight(dataset, train_subset.indices, device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)

    optimizer = optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

    # 3. Training loop with per-epoch validation and best-checkpoint tracking
    best_val_auc = -1.0
    os.makedirs(os.path.dirname(CHECKPOINT_PATH), exist_ok=True)

    for epoch in range(1, EPOCHS + 1):
        avg_step_loss = train_one_epoch(model, train_subset, edge_index, optimizer, criterion, device)
        val_metrics = evaluate(model, val_subset, edge_index, device)
        current_lr = scheduler.get_last_lr()[0]
        scheduler.step()

        print(
            f"Epoch {epoch:02d}/{EPOCHS} | LR: {current_lr:.6f} | "
            f"Train BCE/Step: {avg_step_loss:.4f} | "
            f"Val AUC: {val_metrics['auc']:.4f} "
            f"(cold: {val_metrics['cold_auc']:.4f}, steady: {val_metrics['steady_auc']:.4f})"
        )

        if val_metrics['auc'] > best_val_auc:
            best_val_auc = val_metrics['auc']
            torch.save({
                'model_state_dict': model.state_dict(),
                'epoch': epoch,
                'val_auc': best_val_auc,
            }, CHECKPOINT_PATH)
            print(f"  -> New best val AUC ({best_val_auc:.4f}). Saved checkpoint to {CHECKPOINT_PATH}")

    # 4. Final evaluation on the held-out test split, using the best checkpoint
    checkpoint = torch.load(CHECKPOINT_PATH, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint['model_state_dict'])
    test_metrics = evaluate(model, test_subset, edge_index, device)

    print("\n--- Final Test Evaluation (best checkpoint, held-out students) ---")
    print(f"Overall AUC-ROC:            {test_metrics['auc']:.4f} (Target: > 0.75)")
    print(f"Overall Accuracy:           {test_metrics['acc']:.4f}")
    print(f"Overall F1-Score:           {test_metrics['f1']:.4f}")
    print(f"Cold-start AUC (steps 1-2): {test_metrics['cold_auc']:.4f}")
    print(f"Steady-state AUC (3-25):    {test_metrics['steady_auc']:.4f}")


if __name__ == "__main__":
    main()
