"""The serving-only (NEURO_LITE=1) replacements must be numerically equivalent to the research code.
Needs torch_geometric and stable-baselines3 installed (the full dev environment)."""
import os
import subprocess
import sys

import numpy as np
import pytest
import torch

pytest.importorskip("torch_geometric")
pytest.importorskip("stable_baselines3")

import networkx as nx  # noqa: E402
from torch_geometric.nn import GATConv as PygGATConv  # noqa: E402
from torch_geometric.utils import from_networkx  # noqa: E402

from knowledge_graph.graph_builder import CONCEPTS, build_python_dag  # noqa: E402
from serving.lite import edge_index_from_graph  # noqa: E402
from serving.lite_ppo import load_ppo_lite  # noqa: E402
from tracker import dual_gcn  # noqa: E402
from tracker.gat_lite import GATConv as LiteGATConv  # noqa: E402

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOL = 1e-5


def bidir_edges():
    ei = from_networkx(build_python_dag()).edge_index
    return torch.cat([ei, ei.flip(0)], dim=1).unique(dim=1)


def pair(in_c, out_c, heads, dropout=0.1):
    torch.manual_seed(0)
    a = PygGATConv(in_c, out_c, heads=heads, bias=False, add_self_loops=True, dropout=dropout).eval()
    b = LiteGATConv(in_c, out_c, heads=heads, bias=False, add_self_loops=True, dropout=dropout).eval()
    b.load_state_dict(a.state_dict())          # identical parameter names and shapes: strict load
    return a, b


@pytest.mark.parametrize("seed", range(5))
def test_gat_layer_matches_torch_geometric(seed):
    torch.manual_seed(seed)
    a, b = pair(64, 16, 4)
    ei = bidir_edges()
    for x in (torch.randn(25, 64), torch.zeros(25, 64), torch.relu(torch.randn(25, 64)) * (torch.rand(25, 1) > 0.7)):
        with torch.no_grad():
            assert torch.allclose(a(x, ei), b(x, ei), atol=TOL, rtol=1e-4)


def test_gat_layer_matches_on_batched_disjoint_graphs():
    a, b = pair(64, 16, 4)
    ei = bidir_edges()
    batch = 7
    big = torch.cat([ei + i * 25 for i in range(batch)], dim=1)
    x = torch.randn(25 * batch, 64)
    with torch.no_grad():
        assert torch.allclose(a(x, big), b(x, big), atol=TOL, rtol=1e-4)


def test_zero_input_gives_exactly_zero_like_the_original():
    """The tracker's exact-reachability gate relies on bias-free GAT layers mapping zeros to zeros."""
    a, b = pair(64, 16, 4)
    x = torch.zeros(25, 64)
    with torch.no_grad():
        assert torch.count_nonzero(b(x, bidir_edges())) == 0 and torch.count_nonzero(a(x, bidir_edges())) == 0


def test_edge_index_matches_from_networkx_exactly():
    g = build_python_dag()
    assert torch.equal(edge_index_from_graph(g), from_networkx(g).edge_index)


def test_unsupported_configurations_fail_loudly():
    with pytest.raises(NotImplementedError):
        LiteGATConv(8, 4, heads=2, concat=False, bias=False)
    with pytest.raises(NotImplementedError):
        LiteGATConv(8, 4, heads=2, bias=True)


def build_tracker(checkpoint, lite):
    """The same trained DualGCNTracker, built with either GATConv implementation."""
    original = dual_gcn.GATConv
    dual_gcn.GATConv = LiteGATConv if lite else PygGATConv
    try:
        ck = torch.load(os.path.join(BACKEND, "tracker", checkpoint), map_location="cpu", weights_only=False)
        t = dual_gcn.DualGCNTracker.from_config(ck["config"]) if "config" in ck else dual_gcn.DualGCNTracker()
        t.load_state_dict(ck["model_state_dict"])
    finally:
        dual_gcn.GATConv = original
    return t.eval()


@pytest.mark.parametrize("checkpoint", ["dual_gcn_weights_v2.pth", "dual_gcn_weights_v1.pth"])
def test_full_tracker_gives_the_same_beliefs_for_random_student_histories(checkpoint):
    """Replays 40 random histories (up to 30 interactions each) through both trackers."""
    orig, lite = build_tracker(checkpoint, False), build_tracker(checkpoint, True)
    ei = from_networkx(build_python_dag()).edge_index
    rng = np.random.RandomState(42)
    worst = 0.0
    for _ in range(40):
        h1, h2 = orig.init_state(), lite.init_state()
        for _ in range(rng.randint(1, 31)):
            node, passed, t = int(rng.randint(0, 25)), int(rng.rand() < 0.55), float(rng.rand())
            with torch.no_grad():
                h1, h2 = orig(ei, node, passed, t, h1), lite(ei, node, passed, t, h2)
        with torch.no_grad():
            b1 = torch.stack([orig.predict_node(h1, i) for i in range(25)])
            b2 = torch.stack([lite.predict_node(h2, i) for i in range(25)])
        worst = max(worst, float((torch.sigmoid(b1) - torch.sigmoid(b2)).abs().max()))
    assert worst < TOL, f"max belief difference {worst}"


@pytest.mark.parametrize("zipname", ["ppo_tutor_v2.zip", "ppo_tutor.zip"])
def test_lite_ppo_policy_matches_stable_baselines3(zipname):
    from stable_baselines3 import PPO
    path = os.path.join(BACKEND, "agent", zipname)
    sb3, lite = PPO.load(path, device="cpu"), load_ppo_lite(path)
    rng = np.random.RandomState(0)
    obs = torch.as_tensor(np.concatenate([rng.rand(64, 25), (rng.rand(64, 25) > 0.5), rng.randint(0, 11, (64, 25)) / 10.0], axis=1), dtype=torch.float32)
    with torch.no_grad():
        p1 = sb3.policy.get_distribution(obs).distribution.probs
        p2 = lite.policy.get_distribution(obs).distribution.probs
    assert p1.shape == p2.shape == (64, 25)
    assert torch.allclose(p1, p2, atol=1e-6)
    assert lite.policy.device.type == "cpu"


def test_lite_mode_keeps_the_heavy_libraries_out_of_memory():
    code = (
        "import os, sys; os.environ['NEURO_LITE']='1'; os.environ['USE_QUESTION_BANK']='true'; sys.path.insert(0, '.');"
        "import main, serving.content_engine as c; main._load_ppo(main.PPO_CHECKPOINT_PATH); "
        "bad=[m for m in ('torch_geometric','stable_baselines3','gymnasium','pandas','agent.tutoring_env') if m in sys.modules];"
        "print('HEAVY:', bad)"
    )
    out = subprocess.run([sys.executable, "-c", code], cwd=BACKEND, capture_output=True, text=True, timeout=300)
    assert out.returncode == 0, out.stderr[-500:]
    assert "HEAVY: []" in out.stdout, out.stdout
