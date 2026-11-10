import os
import sys
from collections import Counter

from stable_baselines3 import PPO

# backend/ root, one level up from experiments/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agent.ppo_trainer import TutoringEnv, TRACKER_CHECKPOINT_PATH, linear_curriculum_policy_fn, ppo_policy_fn
from knowledge_graph.graph_builder import CONCEPTS

model = PPO.load("agent/ppo_tutor.zip")


def trace_episode(policy_fn, seed, label):
    env = TutoringEnv(checkpoint_path=TRACKER_CHECKPOINT_PATH)
    obs, info = env.reset(seed=seed)
    blocked_hits = 0
    concept_sequence = []
    total_reward = 0.0
    terminated = truncated = False
    step = 0
    while not (terminated or truncated):
        action = policy_fn(obs, env)
        concept = CONCEPTS[action]
        obs, reward, terminated, truncated, info = env.step(action)
        total_reward += reward
        if reward <= -0.15:  # blocked_penalty regime (-0.02-0.06-0.10=-0.18)
            blocked_hits += 1
        concept_sequence.append(concept)
        step += 1

    counts = Counter(concept_sequence)
    print(f"{label:8s} seed={seed} | steps={step:3d} success={str(terminated):5s} "
          f"final_mastery={info['avg_true_mastery']:.3f} total_reward={total_reward:+7.2f} "
          f"blocked_hits={blocked_hits:3d} unique_concepts={len(counts)}/25 "
          f"top_repeats={counts.most_common(3)}")
    return concept_sequence


for seed in [20000, 20001, 20002, 20003, 20004, 20005]:
    trace_episode(linear_curriculum_policy_fn(), seed, "linear")
    trace_episode(ppo_policy_fn(model), seed, "ppo")
    print()
