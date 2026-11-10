import json
import os
import sys

from stable_baselines3 import PPO

# backend/ root, one level up from experiments/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agent.ppo_trainer import train, evaluate_policies, make_env

print("=== Loading restored baseline PPO (503,104 steps) for entropy-decay continuation ===", flush=True)
env = make_env()
model = PPO.load("agent/ppo_tutor.zip", env=env)
print(f"Loaded model at {model.num_timesteps} timesteps, ent_coef={model.ent_coef}", flush=True)

print("=== Continuing training with entropy decay (0.02 -> 0.002) for 300,000 more timesteps ===", flush=True)
model, env = train(total_timesteps=300000, model=model, env=env, ent_coef_schedule=(0.02, 0.002))

print("\n=== Training complete. Evaluating vs baselines (100 episodes each) ===", flush=True)
results = evaluate_policies(episodes=100, ppo_model=model)

print("\n=== FINAL RESULTS ===")
print(json.dumps(results, indent=2))
