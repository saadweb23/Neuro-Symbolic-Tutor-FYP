import os
import sys

import torch
from torch_geometric.utils import from_networkx

# Add the backend/ root to the path (this file is now two levels down, in
# serving/), matching the convention already used by agent/*.py.
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from knowledge_graph.graph_builder import CONCEPTS, CONCEPT_TO_ID, build_python_dag
from agent.tutoring_env import load_frozen_tracker, DEFAULT_CHECKPOINT

MAX_TIME = 180.0

__all__ = [
    "build_edge_index",
    "model_version_from_checkpoint",
    "get_mastery_beliefs",
    "apply_interaction",
    "load_frozen_tracker",
    "DEFAULT_CHECKPOINT",
]


def build_edge_index(device='cpu'):
    graph = build_python_dag()
    return from_networkx(graph).edge_index.to(device)


def model_version_from_checkpoint(checkpoint_path=DEFAULT_CHECKPOINT):
    """Cheap version tag for a tracker checkpoint, used to detect whether a
    cached mastery state was produced by a since-replaced model."""
    if not os.path.exists(checkpoint_path):
        return "untrained"
    return str(int(os.path.getmtime(checkpoint_path)))


def get_mastery_beliefs(tracker, h_t):
    """The agent's/frontend's belief about mastery of every concept, read
    from the tracker -- not ground truth. Returns {concept_name: prob}."""
    with torch.no_grad():
        logits = torch.stack([
            tracker.predict_node(h_t, node_id) for node_id in range(len(CONCEPTS))
        ])
        probs = torch.sigmoid(logits).cpu().tolist()
    return {concept: probs[CONCEPT_TO_ID[concept]] for concept in CONCEPTS}


def apply_interaction(tracker, edge_index, h_t, concept, passed, time_taken, max_time=MAX_TIME):
    """Advances the tracker's hidden state by one observed interaction.
    Shared by the placement quiz and the main tutoring loop so both use
    the exact same concept-ID resolution and time normalization."""
    node_id = CONCEPT_TO_ID[concept]
    norm_time = min(time_taken / max_time, 1.0)
    with torch.no_grad():
        h_t_next = tracker(edge_index, node_id, int(passed), norm_time, h_t)
    return h_t_next
