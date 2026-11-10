"""Fair, paired evaluation of tutoring policies in TutoringEnv.

Why not just "success rate"? The environment's success rule (average TRUE
mastery >= 0.65) is only reachable by students whose own mastery ceiling allows
it: mastery of a concept is capped by its prerequisites and by the student's
base ability, so only ~15% of simulated students could EVER reach 0.65 even with
unlimited steps and a perfect policy. Success rate therefore mostly measures
which students were drawn, not how good the policy is. Here every policy is
run on the SAME seeded students and judged by

  attainment      final average mastery / that student's maximum reachable average
  efficiency      average attainment over the whole 150-step budget (fast learning scores higher)
  steps to 50/80% steps until 50% / 80% of the student's reachable mastery is attained
  success         reaching 0.65 (overall, and among the students for whom it is reachable)
"""
import math

import networkx as nx
import numpy as np
import torch

from agent.tutoring_env import TutoringEnv
from knowledge_graph.graph_builder import CONCEPTS, CONCEPT_TO_ID, build_python_dag

MAX_STEPS = TutoringEnv.MAX_STEPS
_TOPO = [CONCEPT_TO_ID[c] for c in nx.topological_sort(build_python_dag())]


def reachable_average(env):
    """Highest average true mastery this student could ever reach (every
    concept driven to its prerequisite-gated cap), given the traits just
    sampled by env.reset()."""
    base = env._student_traits["base_mastery"]
    m = {}
    for i in _TOPO:
        c = CONCEPTS[i]
        pre = env.prereqs[c]
        ceiling = 1.0 if not pre else 0.5 * np.mean([m[p] for p in pre]) + 0.5 * min(m[p] for p in pre)
        m[c] = ceiling * base
    return float(np.mean(list(m.values())))


# ----------------------------------------------------------------------
# Policies. Each builder returns a fresh fn(obs, env) -> action.
# ----------------------------------------------------------------------
def random_policy():
    return lambda obs, env: int(env.action_space.sample())


def linear_curriculum_policy():
    state = {"i": 0}

    def _policy(obs, env):
        action = _TOPO[state["i"] % len(_TOPO)]
        state["i"] += 1
        return action
    return _policy


def structure_aware_policy():
    n = len(CONCEPTS)

    def _policy(obs, env):
        belief, attempted = obs[:n], obs[n:2 * n]
        eligible = [i for i in range(n) if attempted[i] >= 0.5] or list(range(n))
        return int(min(eligible, key=lambda i: belief[i]))
    return _policy


def sweep_policy():
    """Visit-count sweep in curriculum order: always the least-visited concept
    (ties broken by topological order). A pure function of the observation, so
    it can be imitated by a neural policy (the linear baseline's action comes
    from an internal counter, which a network cannot reproduce from obs)."""
    n = len(CONCEPTS)
    rank = {c: r for r, c in enumerate(_TOPO)}

    def _policy(obs, env):
        visits = obs[2 * n:3 * n]
        return int(min(range(n), key=lambda i: (round(float(visits[i]) * env.VISIT_COUNT_CAP), rank[i])))
    return _policy


def greedy_oracle_policy():
    """REFERENCE ONLY: peeks at the hidden true state and picks the concept with
    the largest immediate mastery gain. Myopic, so not guaranteed optimal; it
    shows how much a policy with perfect information about the student gains."""
    def _policy(obs, env):
        lr = env._student_traits["learn_rate"]
        base = env._student_traits["base_mastery"]
        best, best_gain = 0, -1.0
        for i, c in enumerate(CONCEPTS):
            cap = env._mastery_ceiling(c) * base
            prior = min(env.mastery[c], cap)
            gain = min(prior + (1 - prior) * lr, cap) - prior
            if gain > best_gain + 1e-12:
                best, best_gain = i, gain
        return best
    return _policy


def ppo_policy(model, deterministic=False):
    def _policy(obs, env):
        action, _ = model.predict(obs, deterministic=deterministic)
        return int(action)
    return _policy


# ----------------------------------------------------------------------
# Running + summarising
# ----------------------------------------------------------------------
def run_paired(env, policy_builder, seeds):
    episodes = []
    for seed in seeds:
        obs, _ = env.reset(seed=seed)
        env.action_space.seed(seed)
        torch.manual_seed(seed)
        reach = reachable_average(env)
        policy = policy_builder()
        curve, terminated, truncated, info = [], False, False, {}
        while not (terminated or truncated):
            obs, _, terminated, truncated, info = env.step(policy(obs, env))
            curve.append(info["avg_true_mastery"])
        steps = len(curve)
        padded = np.array(curve + [curve[-1]] * (MAX_STEPS - steps))
        att = padded / reach

        def steps_to(frac):
            hit = np.nonzero(att >= frac)[0]
            return int(hit[0]) + 1 if len(hit) else MAX_STEPS + 1     # censored: never reached

        episodes.append({
            "seed": int(seed), "reachable": reach, "final": float(curve[-1]),
            "attainment": float(att[-1]), "efficiency": float(att.mean()),
            "steps_to_50": steps_to(0.5), "steps_to_80": steps_to(0.8),
            "success": bool(terminated), "feasible": bool(reach >= TutoringEnv.MASTERY_THRESHOLD),
        })
    return episodes


def bootstrap_ci(values, n_boot=2000, seed=0):
    values = np.asarray(values, dtype=float)
    rng = np.random.RandomState(seed)
    means = [values[rng.randint(0, len(values), len(values))].mean() for _ in range(n_boot)]
    return float(values.mean()), float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def summarize(episodes):
    out = {"episodes": len(episodes)}
    for key in ("final", "attainment", "efficiency"):
        out[key] = bootstrap_ci([e[key] for e in episodes])
    for key in ("steps_to_50", "steps_to_80"):
        vals = [e[key] for e in episodes]
        out[key] = bootstrap_ci(vals)
        out[key + "_reached_share"] = float(np.mean([v <= MAX_STEPS for v in vals]))
    out["success_rate"] = float(np.mean([e["success"] for e in episodes]))
    feas = [e for e in episodes if e["feasible"]]
    out["feasible_share"] = len(feas) / len(episodes)
    out["success_rate_feasible"] = float(np.mean([e["success"] for e in feas])) if feas else float("nan")
    return out


def paired_difference(a, b, key="attainment"):
    """Mean per-student difference a - b (same seeds) with a bootstrap 95% CI."""
    sb = {e["seed"]: e for e in b}
    return bootstrap_ci([e[key] - sb[e["seed"]][key] for e in a if e["seed"] in sb])
