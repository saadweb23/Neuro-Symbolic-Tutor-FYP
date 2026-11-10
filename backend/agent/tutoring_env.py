import math
import os
import random
import sys

import gymnasium as gym
import numpy as np
import torch
from gymnasium import spaces
from torch_geometric.utils import from_networkx

# Add the backend/ root to the path so this still works when run/imported
# directly, not just via `python -m`.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from knowledge_graph.graph_builder import CONCEPTS, CONCEPT_TO_ID, build_python_dag
from tracker.dual_gcn import DualGCNTracker
from data_generation.math_simulator import (
    LEARNER_PROFILES,
    compute_concept_difficulty,
    sample_beta,
    sigmoid,
    logit,
)

# Tracker served by the app (and used by the PPO environment). Defaults to the v2 tracker.
# Rollback: set TRACKER_CHECKPOINT to tracker/dual_gcn_weights_v1.pth (the original model)
# AND PPO_CHECKPOINT to agent/ppo_tutor.zip -- the PPO must match the tracker it was trained with.
DEFAULT_CHECKPOINT = os.environ.get('TRACKER_CHECKPOINT') or os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tracker', 'dual_gcn_weights_v2.pth'
)


def load_frozen_tracker(num_nodes=25, feature_dim=64, hidden_dim=64,
                         checkpoint_path=DEFAULT_CHECKPOINT, device='cpu'):
    """Loads the pre-trained Dual-GCN as a frozen perception module. The PPO
    agent never trains this network -- it only reads mastery estimates from
    it, exactly as Phase 4 of the proposal describes ("backend hosts the
    pre-trained Dual GCN... passes the new state to the PPO Agent")."""
    tracker = DualGCNTracker(num_nodes=num_nodes, feature_dim=feature_dim, hidden_dim=hidden_dim).to(device)
    if os.path.exists(checkpoint_path):
        # weights_only=False: this checkpoint is generated locally by
        # train_tracker.py, not loaded from an untrusted third party.
        checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
        # Newer checkpoints record their own architecture (global learner
        # state, log-time feature, serving offset); original ones have no
        # 'config' and load as the original architecture.
        if 'config' in checkpoint:
            tracker = DualGCNTracker.from_config(checkpoint['config']).to(device)
        tracker.load_state_dict(checkpoint['model_state_dict'])
        print(f"[TutoringEnv] Loaded pre-trained tracker weights from {checkpoint_path}")
    else:
        print(f"[TutoringEnv] WARNING: no checkpoint at {checkpoint_path} -- "
              f"using a randomly-initialized tracker. Train it with train_tracker.py first.")
    tracker.eval()
    for param in tracker.parameters():
        param.requires_grad_(False)
    return tracker


class TutoringEnv(gym.Env):
    """Gymnasium environment for the remediation agent.

    - Action space: which of the 25 concepts to present next (Discrete).
    - Observation space: 75-dim, three 25-length blocks concatenated:
        1. belief -- the tracker's predicted mastery per concept. Noisy,
           especially cold-start (measured AUC ~0.43-0.53 for steps 1-2 of a
           real student), so it alone can't reliably tell "genuinely weak"
           from "prerequisite-blocked" early in an episode.
        2. prereq_attempted -- for each concept, 1.0 iff every one of its
           prerequisites has been picked at least once this episode (1.0
           vacuously for root concepts). Ground-truth bookkeeping, not a
           tracker prediction, so it isn't fooled by cold-start miscalibration
           the way belief is -- and it's legitimately deployable, since it's
           just a count derived from real logged interaction history (see
           serving/content_engine.py's matching construction), not hidden
           simulator state.
        3. visit_count -- how many times THIS concept itself has been picked
           this episode, normalized to [0, 1] (capped at VISIT_COUNT_CAP).
           Also ground-truth bookkeeping; complements belief for spotting
           "I've already hammered this one" independent of what the tracker
           currently predicts.
      Diagnosed need: a pure-belief observation let both a naive
      argmin(belief) heuristic AND a prerequisite-aware-but-belief-gated
      heuristic get permanently stuck picking a concept whose true mastery
      ceiling was 0.0 (blocked on an unmastered prerequisite) for an entire
      150-step episode, because cold-start belief falsely read prerequisites
      as satisfied. prereq_attempted sidesteps that specific failure mode by
      not depending on the tracker being calibrated at all.
    - Reward: marginal gain in the student's TRUE mastery (hidden from the
      agent, known only to this environment's internal student simulator)
      minus a small per-step cost, so idle or redundant recommendations are
      penalized and genuine progress is rewarded -- "Learning Efficiency" as
      specified in the proposal's reward function. A concept whose
      prerequisite-gated ceiling is currently exactly 0 (blocked, not just
      saturated) additionally takes BLOCKED_PENALTY on top of the ordinary
      step cost / repeat penalty, so "impossible right now" and "already
      mastered" are distinguishable signals instead of looking identical.

    The internal "true student" reuses the same BKT/IRT generative model as
    data_generation/math_simulator.py (individual traits sampled per profile,
    concept difficulty by curriculum depth), but adapted for an interactive,
    revisit-anywhere setting: a concept's true mastery is hard-capped by its
    prerequisites' current mastery, so no amount of drilling a concept lets a
    student exceed what its prerequisites currently support. This is what
    makes premature or redundant recommendations score near-zero reward
    without needing a hand-tuned penalty term.
    """

    metadata = {"render_modes": []}

    # Learn rates in math_simulator.py mean a concept needs several repeat
    # visits to approach its ceiling (e.g. ~14 for the Struggling profile's
    # ~0.20 learn rate). MAX_STEPS/MASTERY_THRESHOLD are set so a genuinely
    # good policy can reach the threshold within budget -- an unreachable
    # threshold gives every policy a 0% success rate and starves training of
    # any real success signal to learn from.
    MAX_STEPS = 150
    MASTERY_THRESHOLD = 0.65
    STEP_COST = 0.02
    REPEAT_PENALTY_WEIGHT = 0.06
    # Extra penalty (on top of STEP_COST + REPEAT_PENALTY_WEIGHT) when the
    # picked concept's prerequisite-gated ceiling is currently exactly 0 --
    # i.e. genuinely blocked, not merely already-saturated. Without this the
    # two cases produce the identical -0.08 reward (see prior_saturation's
    # `else 1.0` branch below), giving the policy no gradient to learn "this
    # one is impossible right now" as a distinct pattern from "I've already
    # maxed this one out".
    BLOCKED_PENALTY = 0.10
    # Flat bonus the first time a concept is picked this episode (visit_counts
    # was 0 beforehand). Diagnosed via direct trace: linear_curriculum wins
    # because its fixed round-robin visits every concept exactly evenly (6
    # times each in a 150-step episode, by construction), while PPO learned
    # to concentrate 2-3x the average attention on a handful of concepts,
    # leaving others under-served -- average mastery across 25 concepts with
    # per-concept diminishing returns rewards breadth, and nothing in the
    # reward previously said so explicitly. This is additive to, not a
    # replacement for, repeat_penalty/BLOCKED_PENALTY.
    COVERAGE_BONUS = 0.10
    VISIT_COUNT_CAP = 10
    MAX_TIME = 180.0

    def __init__(self, checkpoint_path=DEFAULT_CHECKPOINT, device='cpu'):
        super().__init__()
        self.device = torch.device(device)
        self.graph = build_python_dag()
        self.num_nodes = len(CONCEPTS)
        self.edge_index = from_networkx(self.graph).edge_index.to(self.device)
        self.concept_difficulty = compute_concept_difficulty(self.graph)
        self.prereqs = {c: list(self.graph.predecessors(c)) for c in CONCEPTS}

        self.tracker = load_frozen_tracker(num_nodes=self.num_nodes, checkpoint_path=checkpoint_path,
                                            device=str(self.device))

        self.action_space = spaces.Discrete(self.num_nodes)
        self.observation_space = spaces.Box(low=0.0, high=1.0, shape=(3 * self.num_nodes,), dtype=np.float32)

        self.h_t = None
        self.mastery = None
        self.visit_counts = None
        self.step_count = 0
        self._student_traits = None

    def _sample_student(self):
        profile_name = random.choice(list(LEARNER_PROFILES.keys()))
        profile = LEARNER_PROFILES[profile_name]
        return {
            "profile": profile_name,
            "base_mastery": sample_beta(profile["base_mastery_mean"], profile["base_mastery_conc"]),
            "slip_rate": sample_beta(profile["slip_mean"], profile["slip_conc"]),
            "guess_rate": sample_beta(profile["guess_mean"], profile["guess_conc"]),
            "learn_rate": sample_beta(profile["learn_mean"], profile["learn_conc"]),
        }

    def _mastery_ceiling(self, concept):
        prereqs = self.prereqs[concept]
        if not prereqs:
            return 1.0
        prereq_masteries = [self.mastery[p] for p in prereqs]
        return 0.5 * (sum(prereq_masteries) / len(prereq_masteries)) + 0.5 * min(prereq_masteries)

    def _observe(self):
        with torch.no_grad():
            # One batched call for all concepts (same numbers as querying them
            # one by one, ~3x faster per environment step).
            nodes = torch.arange(self.num_nodes, device=self.device)
            states = self.h_t.unsqueeze(0).expand(self.num_nodes, -1, -1)
            belief = torch.sigmoid(self.tracker.predict_batch(states, nodes)).cpu().numpy().astype(np.float32)

        prereq_attempted = np.array([
            1.0 if all(self.visit_counts[p] > 0 for p in self.prereqs[c]) else 0.0
            for c in CONCEPTS
        ], dtype=np.float32)
        visit_count_norm = np.array([
            min(self.visit_counts[c], self.VISIT_COUNT_CAP) / self.VISIT_COUNT_CAP
            for c in CONCEPTS
        ], dtype=np.float32)

        return np.concatenate([belief, prereq_attempted, visit_count_norm])

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        if seed is not None:
            random.seed(seed)

        self._student_traits = self._sample_student()
        self.mastery = {c: 0.0 for c in CONCEPTS}
        self.visit_counts = {c: 0 for c in CONCEPTS}
        self.h_t = self.tracker.init_state(device=self.device)
        self.step_count = 0

        observation = self._observe()
        info = {"profile": self._student_traits["profile"]}
        return observation, info

    def step(self, action):
        concept = CONCEPTS[int(action)]
        traits = self._student_traits

        ceiling = self._mastery_ceiling(concept)
        target_cap = ceiling * traits["base_mastery"]
        prior_knowledge = min(self.mastery[concept], target_cap)

        difficulty = self.concept_difficulty[concept]
        p_know_effective = sigmoid(logit(max(prior_knowledge, 1e-6)) - difficulty)

        covered = random.random() < p_know_effective
        if covered:
            passed = 0 if random.random() < traits["slip_rate"] else 1
        else:
            passed = 1 if random.random() < traits["guess_rate"] else 0

        if covered and passed == 1:
            time_mu = 32
        elif covered and passed == 0:
            time_mu = 68
        elif not covered and passed == 1:
            time_mu = 16
        else:
            time_mu = 52
        time_taken = min(max(random.lognormvariate(math.log(time_mu), 0.35), 8), 280)
        norm_time = min(time_taken / self.MAX_TIME, 1.0)

        # How saturated this concept already was BEFORE this attempt, relative
        # to what it's currently capable of (0 = untouched, 1 = fully at its
        # prerequisite-gated ceiling). Used below to make repeated visits to
        # an already-maxed-out concept unambiguously bad, on top of the gain
        # itself naturally shrinking near the cap -- a tried unlock-bonus
        # alternative was scrapped because it could be gamed by picking
        # high-fan-out concepts regardless of whether their unlocked
        # dependents were ever actually visited.
        is_blocked = target_cap <= 1e-6
        prior_saturation = prior_knowledge / target_cap if not is_blocked else 1.0
        repeat_penalty = self.REPEAT_PENALTY_WEIGHT * prior_saturation
        blocked_penalty = self.BLOCKED_PENALTY if is_blocked else 0.0
        coverage_bonus = self.COVERAGE_BONUS if self.visit_counts[concept] == 0 else 0.0

        prev_sum = sum(self.mastery.values())
        new_mastery = prior_knowledge + (1 - prior_knowledge) * traits["learn_rate"]
        self.mastery[concept] = min(new_mastery, target_cap)
        new_sum = sum(self.mastery.values())

        reward = (new_sum - prev_sum) - self.STEP_COST - repeat_penalty - blocked_penalty + coverage_bonus

        with torch.no_grad():
            self.h_t = self.tracker(self.edge_index, int(action), passed, norm_time, self.h_t)

        self.visit_counts[concept] += 1
        self.step_count += 1
        observation = self._observe()

        avg_mastery = new_sum / self.num_nodes
        terminated = avg_mastery >= self.MASTERY_THRESHOLD
        truncated = self.step_count >= self.MAX_STEPS

        info = {
            "concept": concept,
            "passed": passed,
            "avg_true_mastery": avg_mastery,
        }
        return observation, reward, terminated, truncated, info
