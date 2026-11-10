"""Stable-Baselines3-free PPO policy loader for SERVING ONLY (selected by NEURO_LITE=1).

The API only ever asks the trained PPO policy for its action probabilities
(`policy.get_distribution(obs).distribution.probs`). stable-baselines3 (+gymnasium, pandas, ...) costs
tens of MB to import just for that, so this module rebuilds the same MLP policy from the weights inside
the SB3 zip (`policy.pth`) with plain PyTorch:

    obs -> Linear -> Tanh -> Linear -> Tanh -> action_net -> softmax        (SB3's default PPO MlpPolicy)

Layer sizes are read from the weight shapes; both shipped checkpoints use the default Tanh activation
and no observation normalisation. tests/test_lite_equivalence.py proves the probabilities match
`PPO.load(...)` for both checkpoints.
"""
import io
import zipfile
from types import SimpleNamespace

import torch
import torch.nn as nn


class LitePolicy(nn.Module):
    def __init__(self, obs_dim, hidden, n_actions):
        super().__init__()
        layers, last = [], obs_dim
        for size in hidden:
            layers += [nn.Linear(last, size), nn.Tanh()]
            last = size
        self.policy_net = nn.Sequential(*layers)
        self.action_net = nn.Linear(last, n_actions)

    @property
    def device(self):
        return next(self.parameters()).device

    def get_distribution(self, obs):
        logits = self.action_net(self.policy_net(obs.float()))
        return SimpleNamespace(distribution=SimpleNamespace(probs=torch.softmax(logits, dim=-1)))


def load_ppo_lite(path, device="cpu"):
    """Returns an object with `.policy` exposing the two members the serving code uses
    (`device`, `get_distribution`), like a loaded stable-baselines3 PPO."""
    with zipfile.ZipFile(path) as z:
        state = torch.load(io.BytesIO(z.read("policy.pth")), map_location=device, weights_only=True)
    hidden, i = [], 0
    while f"mlp_extractor.policy_net.{i}.weight" in state:
        hidden.append(state[f"mlp_extractor.policy_net.{i}.weight"].shape[0])
        i += 2                                              # Linear layers sit at even positions (Tanh in between)
    obs_dim = state["mlp_extractor.policy_net.0.weight"].shape[1]
    n_actions = state["action_net.weight"].shape[0]
    policy = LitePolicy(obs_dim, hidden, n_actions).to(device)
    mapped = {}
    for k, v in state.items():
        if k.startswith("mlp_extractor.policy_net."):
            mapped["policy_net." + k[len("mlp_extractor.policy_net."):]] = v
        elif k.startswith("action_net."):
            mapped[k] = v
    policy.load_state_dict(mapped)       # strict: any mismatch is an error, never a silently different policy
    policy.eval()
    for p in policy.parameters():
        p.requires_grad_(False)
    return SimpleNamespace(policy=policy)
