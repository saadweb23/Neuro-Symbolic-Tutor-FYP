"""Serving-only replacements for the two heavy research dependencies (NEURO_LITE=1):
 - the frozen-tracker loader and edge index that `agent.tutoring_env` / `torch_geometric.utils`
   provide (importing those pulls in gymnasium, pandas, torch_geometric: ~250 MB)
 - the same logic, in a few lines, with identical results (see tests/test_lite_equivalence.py).
Nothing here is used unless NEURO_LITE=1."""
import os

import torch

from tracker.dual_gcn import DualGCNTracker

# Same default as agent/tutoring_env.py (TRACKER_CHECKPOINT overrides it for the original models).
DEFAULT_CHECKPOINT = os.environ.get('TRACKER_CHECKPOINT') or os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tracker', 'dual_gcn_weights_v2.pth'
)


def load_frozen_tracker(num_nodes=25, feature_dim=64, hidden_dim=64, checkpoint_path=DEFAULT_CHECKPOINT, device='cpu'):
    """Mirror of agent.tutoring_env.load_frozen_tracker."""
    tracker = DualGCNTracker(num_nodes=num_nodes, feature_dim=feature_dim, hidden_dim=hidden_dim).to(device)
    if os.path.exists(checkpoint_path):
        checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
        if 'config' in checkpoint:
            tracker = DualGCNTracker.from_config(checkpoint['config']).to(device)
        tracker.load_state_dict(checkpoint['model_state_dict'])
        print(f"[tracker] Loaded pre-trained tracker weights from {checkpoint_path}")
    else:
        print(f"[tracker] WARNING: no checkpoint at {checkpoint_path} -- using a randomly-initialised tracker.")
    tracker.eval()
    for param in tracker.parameters():
        param.requires_grad_(False)
    return tracker


def edge_index_from_graph(graph, device='cpu'):
    """Same [2, E] tensor as torch_geometric.utils.from_networkx(graph).edge_index: nodes numbered in
    insertion order, edges in G.edges() order."""
    idx = {node: i for i, node in enumerate(graph.nodes())}
    edges = list(graph.edges())
    return torch.tensor([[idx[u] for u, _ in edges], [idx[v] for _, v in edges]], dtype=torch.long, device=device)
