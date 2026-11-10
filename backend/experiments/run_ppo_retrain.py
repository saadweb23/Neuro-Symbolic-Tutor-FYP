import json
import os
import sys

# backend/ root, one level up from experiments/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agent.ppo_trainer import train, evaluate_policies

# Fresh from-scratch training (can't warm-start from the old 503k checkpoint --
# the observation space changed from 25-dim belief-only to 75-dim
# [belief | prereq_attempted | visit_count], see agent/tutoring_env.py) against
# the environment fixes (a) structural/visit-count observation and (b)
# blocked-concept reward shaping, diagnosed and implemented this session.
TOTAL_TIMESTEPS = 300_000

print(f"=== Fresh PPO training ({TOTAL_TIMESTEPS} timesteps) against the fixed environment ===", flush=True)
model, env = train(total_timesteps=TOTAL_TIMESTEPS)

print("\n=== Training complete. Evaluating vs baselines (100 episodes each) ===", flush=True)
results = evaluate_policies(episodes=100, ppo_model=model)

print("\n=== FINAL RESULTS ===")
print(json.dumps(results, indent=2))
