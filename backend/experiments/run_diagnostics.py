import json
import os
import sys

from stable_baselines3 import PPO

# backend/ root, one level up from experiments/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agent.ppo_trainer import (
    TutoringEnv, TRACKER_CHECKPOINT_PATH, random_policy_fn, linear_curriculum_policy_fn,
    ppo_policy_fn, weakest_belief_policy_fn, summarize,
)
from knowledge_graph.graph_builder import CONCEPTS, CONCEPT_TO_ID

N_SEEDS = 100
SEEDS = list(range(10000, 10000 + N_SEEDS))  # fixed, reproducible -- same episodes for every policy


def run_episode_seeded(env, policy_fn, seed):
    obs, info = env.reset(seed=seed)
    total_reward = 0.0
    steps = 0
    terminated = truncated = False
    while not (terminated or truncated):
        action = policy_fn(obs, env)
        obs, reward, terminated, truncated, info = env.step(action)
        total_reward += reward
        steps += 1
    return {
        "steps": steps,
        "reached_mastery": bool(terminated),
        "final_avg_mastery": info["avg_true_mastery"],
        "total_reward": total_reward,
    }


def evaluate_seeded(policy_fn, seeds, checkpoint=TRACKER_CHECKPOINT_PATH):
    env = TutoringEnv(checkpoint_path=checkpoint)
    logs = [run_episode_seeded(env, policy_fn, s) for s in seeds]
    return summarize(logs)


def oracle_policy_fn(obs, env):
    """DIAGNOSTIC ONLY -- cheats by reading env.mastery (true mastery, normally
    hidden from any real policy) to greedily target whichever concept has the
    most prerequisite-gated headroom left. Not deployable; exists purely to
    establish an approximate ceiling on achievable success rate in this
    environment, independent of tracker noise or policy-learning quality."""
    best_concept, best_headroom = None, -1
    for c in CONCEPTS:
        ceiling = env._mastery_ceiling(c)
        headroom = max(0.0, ceiling - env.mastery[c])
        if headroom > best_headroom:
            best_headroom = headroom
            best_concept = c
    return CONCEPT_TO_ID[best_concept]


def structure_aware_policy_fn(obs, env):
    """Deployable (no cheating): weakest belief among concepts whose
    prerequisites are already reasonably believed-mastered (>=0.5), using the
    real prerequisite graph -- exactly the structural information PPO is NOT
    given in its observation. Falls back to globally weakest if none qualify."""
    eligible = [c for c in CONCEPTS if all(obs[CONCEPT_TO_ID[p]] >= 0.5 for p in env.prereqs[c])]
    pool = eligible if eligible else CONCEPTS
    weakest = min(pool, key=lambda c: obs[CONCEPT_TO_ID[c]])
    return CONCEPT_TO_ID[weakest]


results = {}
print(f"Running paired/seeded diagnostics on {N_SEEDS} fixed episodes (same seeds for every policy)...", flush=True)

results["random"] = evaluate_seeded(random_policy_fn, SEEDS)
print("random:", results["random"], flush=True)

results["linear_curriculum"] = evaluate_seeded(linear_curriculum_policy_fn(), SEEDS)
print("linear_curriculum:", results["linear_curriculum"], flush=True)

results["weakest_belief"] = evaluate_seeded(weakest_belief_policy_fn, SEEDS)
print("weakest_belief (belief-only, no structure):", results["weakest_belief"], flush=True)

results["structure_aware"] = evaluate_seeded(structure_aware_policy_fn, SEEDS)
print("structure_aware (belief + real prereq graph, no training):", results["structure_aware"], flush=True)

model = PPO.load("agent/ppo_tutor.zip")
results["ppo_current"] = evaluate_seeded(ppo_policy_fn(model), SEEDS)
print("ppo_current (restored 503k-step baseline):", results["ppo_current"], flush=True)

results["oracle_ceiling"] = evaluate_seeded(oracle_policy_fn, SEEDS)
print("oracle_ceiling (cheats: true mastery -- upper bound only, not deployable):", results["oracle_ceiling"], flush=True)

print("\n=== ALL RESULTS (paired, same", N_SEEDS, "seeds across every policy) ===")
print(json.dumps(results, indent=2))
