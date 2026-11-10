import json
import os
import sys
import time

from stable_baselines3 import PPO

# backend/ root, one level up from experiments/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agent.ppo_trainer import (
    TutoringEnv, TRACKER_CHECKPOINT_PATH, random_policy_fn, linear_curriculum_policy_fn,
    ppo_policy_fn, summarize,
)

N_SEEDS = 100
SEEDS = list(range(20000, 20000 + N_SEEDS))  # fresh seed range, distinct from the earlier diagnostics


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


results = {}
t0 = time.time()
print(f"Running paired/seeded verification on {N_SEEDS} fixed episodes (same seeds for all 3 policies)...", flush=True)

results["random"] = evaluate_seeded(random_policy_fn, SEEDS)
print(f"[{time.time()-t0:.0f}s] random:", results["random"], flush=True)

results["linear_curriculum"] = evaluate_seeded(linear_curriculum_policy_fn(), SEEDS)
print(f"[{time.time()-t0:.0f}s] linear_curriculum:", results["linear_curriculum"], flush=True)

model = PPO.load("agent/ppo_tutor.zip")
results["ppo_new"] = evaluate_seeded(ppo_policy_fn(model), SEEDS)
print(f"[{time.time()-t0:.0f}s] ppo_new (retrained with fixes):", results["ppo_new"], flush=True)

print(f"\n=== ALL RESULTS (paired, same {N_SEEDS} seeds, total time {time.time()-t0:.0f}s) ===")
print(json.dumps(results, indent=2))
