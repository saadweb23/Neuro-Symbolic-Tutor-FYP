"""Placement-style test: show a model ONLY the 7 placement-quiz concepts for each unseen student, then ask it
to predict pass/fail on the other 18 concepts (which it never observed). This is the situation where the
graph is supposed to help: inferring untested concepts from related tested ones."""
import sys, numpy as np, torch
from sklearn.metrics import roc_auc_score
sys.path.insert(0, r"E:\Sohaib Uni Material\FYP\neuro_symbolic_tutor\backend")
from tracker import fast_train as ft
from tracker.dual_gcn import DualGCNTracker
from serving.placement_quiz import PLACEMENT_CONCEPTS
from knowledge_graph.graph_builder import CONCEPT_TO_ID

B = r"E:\Sohaib Uni Material\FYP\neuro_symbolic_tutor\backend"
RUNS = f"{B}/experiments/results/tracker_v2/runs"
fresh = ft.load_sequences(f"{B}/data_generation/extra/fresh_test.csv", f"{B}/data_generation/extra/fresh_test_oracle.csv")
n, T = fresh["nodes"].shape
order = fresh["nodes"][0].tolist()                       # same concept order for every student
seen_ids = [CONCEPT_TO_ID[c] for c in PLACEMENT_CONCEPTS]
seen_steps = sorted(order.index(i) for i in seen_ids)
other_steps = [t for t in range(T) if t not in seen_steps]
y = fresh["passed"].numpy()[:, other_steps]
print(f"students {n} | observed concepts {len(seen_steps)} | concepts to infer {len(other_steps)}")

def load(path, cfg_override=None):
    ck = torch.load(path, weights_only=False)
    m = DualGCNTracker.from_config(ck["config"]) if "config" in ck else DualGCNTracker(25, 64, 64)
    m.load_state_dict(ck["model_state_dict"]); return m.eval()

@torch.no_grad()
def infer(model, edge_index):
    h = model.init_state(batch_size=n)
    for t in seen_steps:
        h = model.forward_batch(edge_index, fresh["nodes"][:, t], fresh["passed"][:, t], fresh["time"][:, t], h)
    cols = [model.predict_batch(h, fresh["nodes"][:, t], apply_offset=False).numpy() for t in other_steps]
    return np.stack(cols, 1)

def score(z, label):
    pooled = roc_auc_score(y.ravel(), z.ravel())
    per_concept = np.mean([roc_auc_score(y[:, j], z[:, j]) for j in range(y.shape[1])])
    print(f"{label:48s} pooled AUC {pooled:.4f} | mean within-concept AUC {per_concept:.4f}")

graph, nograph = ft.get_edge_index(), torch.zeros(2, 0, dtype=torch.long)
prior = np.tile(fresh["passed"].numpy()[:, other_steps].mean(0), (n, 1))     # concept base rates (no student info)
score(prior, "Concept prior only (no student info)")
score(infer(load(f"{B}/tracker/dual_gcn_weights_v1.pth"), graph), "Original deployed model (graph)")
score(infer(load(f"{RUNS}/abl_original_s0.pth"), graph), "Original design, retrained (graph, no global memory)")
score(infer(load(f"{RUNS}/abl_global_s0.pth"), graph), "Global memory + graph")
score(infer(load(f"{RUNS}/abl_nograph_s0.pth"), nograph), "Global memory, GRAPH REMOVED")
score(infer(load(f"{RUNS}/final_s1.pth"), graph), "Final model (global memory + graph)")
score(fresh["oracle"][:, other_steps], "Oracle ceiling (knows hidden traits)")
