import os
import sys

# backend/ root, one level up from experiments/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agent.ppo_trainer import TutoringEnv, TRACKER_CHECKPOINT_PATH, summarize, NUM_CONCEPTS

# Same seed range as the earlier seeded verification, so these numbers are
# directly comparable to the already-measured random (3%/126.7/0.260) and
# linear_curriculum (15%/77.7/0.310) results -- no need to re-run those,
# since COVERAGE_BONUS only changes the training REWARD signal, not the
# environment's actual mastery/termination dynamics.
N_SEEDS = 100
SEEDS = list(range(20000, 20000 + N_SEEDS))


def coverage_first_policy_fn(obs, env):
    """No training involved -- a hand-coded, deployable heuristic that picks
    the LEAST-visited concept among those whose prerequisites have been
    attempted (ground-truth visit_count + prereq_attempted from the
    observation, not tracker belief). Directly implements the "coverage,
    prerequisite-safe" strategy the reward shaping is meant to teach PPO,
    so its result cheaply answers "can this strategy beat linear_curriculum
    at all" before spending an hour+ retraining PPO to discover it via RL.
    """
    prereq_attempted = obs[NUM_CONCEPTS:2 * NUM_CONCEPTS]
    visit_count_norm = obs[2 * NUM_CONCEPTS:3 * NUM_CONCEPTS]
    eligible = [i for i in range(NUM_CONCEPTS) if prereq_attempted[i] >= 0.5]
    pool = eligible if eligible else list(range(NUM_CONCEPTS))
    return int(min(pool, key=lambda i: visit_count_norm[i]))


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
logs = [run_episode_seeded(env, coverage_first_policy_fn, s) for s in SEEDS]
result = summarize(logs)
print("coverage_first (no training, same 100 seeds):", result)
print("\nfor comparison (already measured, same seeds):")
print("  random:            {'success_rate': 0.03, 'mean_steps_to_mastery': 126.67, 'mean_final_avg_mastery': 0.260}")
print("  linear_curriculum: {'success_rate': 0.15, 'mean_steps_to_mastery': 77.67, 'mean_final_avg_mastery': 0.310}")
