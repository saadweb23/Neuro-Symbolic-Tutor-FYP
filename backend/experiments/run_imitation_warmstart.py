import json
import os
import sys

# backend/ root, one level up from experiments/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agent.ppo_trainer import train_with_imitation_warmstart, evaluate_policies

print("=== Starting imitation warm-start + RL fine-tuning ===", flush=True)
model, env = train_with_imitation_warmstart(
    imitation_episodes=200, imitation_epochs=15, rl_timesteps=250000
)

print("\n=== Training complete. Evaluating vs baselines (100 episodes each) ===", flush=True)
results = evaluate_policies(episodes=100, ppo_model=model)

print("\n=== FINAL RESULTS ===")
print(json.dumps(results, indent=2))
