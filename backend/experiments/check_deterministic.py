import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from stable_baselines3 import PPO
from agent.ppo_trainer import TutoringEnv, TRACKER_CHECKPOINT_PATH, ppo_policy_fn, summarize

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


model = PPO.load("agent/ppo_tutor.zip")

env = TutoringEnv(checkpoint_path=TRACKER_CHECKPOINT_PATH)
logs_stochastic = [run_episode_seeded(env, ppo_policy_fn(model, deterministic=False), s) for s in SEEDS]
print("stochastic (deterministic=False, current convention):", summarize(logs_stochastic))

env2 = TutoringEnv(checkpoint_path=TRACKER_CHECKPOINT_PATH)
logs_deterministic = [run_episode_seeded(env2, ppo_policy_fn(model, deterministic=True), s) for s in SEEDS]
print("deterministic (argmax):", summarize(logs_deterministic))
