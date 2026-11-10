import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from stable_baselines3 import PPO
from agent.ppo_trainer import TutoringEnv, TRACKER_CHECKPOINT_PATH, ppo_policy_fn, summarize

# Same seed range as the earlier seeded verification and the coverage_first
# heuristic check, so this is directly comparable: random 3%/126.7/0.260,
# linear_curriculum 15%/77.7/0.310, coverage_first (no training) 15%/67.1/0.310.
N_SEEDS = 100
SEEDS = list(range(20000, 20000 + N_SEEDS))


def run_episode_seeded(env, policy_fn, seed):
    obs, info = env.reset(seed=seed)
    terminated = truncated = False
    steps = 0
    while not (terminated or truncated):
        action = policy_fn(obs, env)
        obs, reward, terminated, truncated, info = env.step(action)
        steps += 1
    return {"steps": steps, "reached_mastery": bool(terminated), "final_avg_mastery": info["avg_true_mastery"]}


env = TutoringEnv(checkpoint_path=TRACKER_CHECKPOINT_PATH)
model = PPO.load("agent/ppo_tutor.zip")
logs = [run_episode_seeded(env, ppo_policy_fn(model), s) for s in SEEDS]
result = summarize(logs)
print("ppo_coverage_retrain (same 100 seeds):", result)
print("\nfor comparison (already measured, same seeds):")
print("  random:            success=0.03  steps=126.67  mastery=0.260")
print("  linear_curriculum: success=0.15  steps=77.67   mastery=0.310")
print("  coverage_first (no training): success=0.15  steps=67.07  mastery=0.310")
