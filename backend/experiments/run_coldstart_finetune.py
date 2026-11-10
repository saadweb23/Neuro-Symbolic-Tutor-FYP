import os
import sys

import torch
import torch.nn as nn
import torch.optim as optim

# backend/ root, one level up from experiments/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from train_tracker import (
    set_seed, split_dataset, compute_pos_weight, train_one_epoch, evaluate,
    SEED, NUM_NODES, FEATURE_DIM, HIDDEN_DIM, VAL_FRAC, TEST_FRAC, CSV_PATH, CHECKPOINT_PATH,
    WEIGHT_DECAY,
)
from tracker.dual_gcn import DualGCNTracker
from tracker.graph_dataset import StudentGraphDataset
from knowledge_graph.graph_builder import build_python_dag

# Short continuation fine-tune (not a full 25-epoch retrain) from the
# existing best checkpoint, upweighting cold-start-step loss to specifically
# target the diagnosed weakness (cold-start AUC ~0.43-0.53 vs ~0.72
# steady-state) without discarding the ~4h13m of training already invested.
FINETUNE_EPOCHS = 10
COLD_START_WEIGHT = 3.0
FINETUNE_LR = 0.0005  # lower than the original 0.002 -- refining a converged point, not starting fresh
OVERALL_AUC_TOLERANCE = 0.01  # don't accept a cold-start gain that costs more than this on overall AUC


def main():
    set_seed(SEED)
    device = torch.device('cpu')
    print(f"Fine-tuning on: {device}", flush=True)

    G = build_python_dag()
    dataset = StudentGraphDataset(csv_file=CSV_PATH, nx_graph=G, num_nodes=NUM_NODES, max_time=180.0)
    edge_index = dataset.edge_index.to(device)
    train_subset, val_subset, test_subset = split_dataset(dataset, VAL_FRAC, TEST_FRAC, SEED)
    print(f"Split sizes -> train: {len(train_subset)} | val: {len(val_subset)} | test: {len(test_subset)}", flush=True)

    model = DualGCNTracker(num_nodes=NUM_NODES, feature_dim=FEATURE_DIM, hidden_dim=HIDDEN_DIM).to(device)
    checkpoint = torch.load(CHECKPOINT_PATH, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint['model_state_dict'])
    print(f"Loaded starting checkpoint from epoch {checkpoint['epoch']}, val_auc={checkpoint['val_auc']:.4f}", flush=True)

    pos_weight = compute_pos_weight(dataset, train_subset.indices, device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = optim.AdamW(model.parameters(), lr=FINETUNE_LR, weight_decay=WEIGHT_DECAY)

    start_metrics = evaluate(model, val_subset, edge_index, device)
    print(f"Starting point -- val AUC: {start_metrics['auc']:.4f} (cold: {start_metrics['cold_auc']:.4f}, "
          f"steady: {start_metrics['steady_auc']:.4f})", flush=True)

    best_cold_auc = start_metrics['cold_auc']
    best_state = {k: v.clone() for k, v in model.state_dict().items()}
    saved_any = False

    for epoch in range(1, FINETUNE_EPOCHS + 1):
        avg_loss = train_one_epoch(model, train_subset, edge_index, optimizer, criterion, device,
                                    cold_start_weight=COLD_START_WEIGHT)
        val_metrics = evaluate(model, val_subset, edge_index, device)
        print(f"Finetune epoch {epoch:02d}/{FINETUNE_EPOCHS} | Train BCE/Step: {avg_loss:.4f} | "
              f"Val AUC: {val_metrics['auc']:.4f} (cold: {val_metrics['cold_auc']:.4f}, "
              f"steady: {val_metrics['steady_auc']:.4f})", flush=True)

        cold_improved = val_metrics['cold_auc'] > best_cold_auc
        overall_ok = val_metrics['auc'] >= start_metrics['auc'] - OVERALL_AUC_TOLERANCE
        if cold_improved and overall_ok:
            best_cold_auc = val_metrics['cold_auc']
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            saved_any = True
            print(f"  -> New best cold-start AUC ({best_cold_auc:.4f}) without regressing overall AUC "
                  f"beyond tolerance. Candidate held in memory.", flush=True)

    print(f"\n=== Fine-tune complete. saved_any={saved_any} ===", flush=True)

    if saved_any:
        torch.save({
            'model_state_dict': best_state,
            'epoch': f"coldstart_finetune(best_cold_auc={best_cold_auc:.4f})",
            'val_auc': best_cold_auc,
        }, CHECKPOINT_PATH)
        print(f"Saved improved checkpoint to {CHECKPOINT_PATH}", flush=True)
    else:
        print("No epoch improved cold-start AUC without regressing overall AUC beyond tolerance -- "
              "checkpoint left unchanged.", flush=True)

    final_model = DualGCNTracker(num_nodes=NUM_NODES, feature_dim=FEATURE_DIM, hidden_dim=HIDDEN_DIM).to(device)
    final_checkpoint = torch.load(CHECKPOINT_PATH, map_location=device, weights_only=False)
    final_model.load_state_dict(final_checkpoint['model_state_dict'])
    test_metrics = evaluate(final_model, test_subset, edge_index, device)
    print("\n--- Final Test Evaluation (checkpoint now on disk, held-out students) ---")
    print(f"Overall AUC-ROC:            {test_metrics['auc']:.4f}")
    print(f"Overall Accuracy:           {test_metrics['acc']:.4f}")
    print(f"Overall F1-Score:           {test_metrics['f1']:.4f}")
    print(f"Cold-start AUC (steps 1-2): {test_metrics['cold_auc']:.4f}")
    print(f"Steady-state AUC (3-25):    {test_metrics['steady_auc']:.4f}")


if __name__ == "__main__":
    main()
