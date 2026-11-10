import os

from .dual_gcn import DualGCNTracker

if os.environ.get("NEURO_LITE") == "1":
    # The training dataset needs pandas + torch_geometric; serving does not (see tracker/gat_lite.py).
    __all__ = ['DualGCNTracker']
else:
    from .graph_dataset import StudentGraphDataset

    __all__ = ['DualGCNTracker', 'StudentGraphDataset']
