import os
import random
import sys

import networkx as nx
import numpy as np
import torch
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback, CallbackList, CheckpointCallback
from stable_baselines3.common.monitor import Monitor

# Add the backend/ root to the path so this still works when run directly
# (`python agent/ppo_trainer.py`), not just as `python -m agent.ppo_trainer`.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agent.tutoring_env import TutoringEnv
from knowledge_graph.graph_builder import CONCEPTS, CONCEPT_TO_ID, build_python_dag

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PPO_CHECKPOINT_PATH = os.path.join(SCRIPT_DIR, 'ppo_tutor.zip')
CHECKPOINT_DIR = os.path.join(SCRIPT_DIR, 'checkpoints')
TRACKER_CHECKPOINT_PATH = os.path.join(os.path.dirname(SCRIPT_DIR), 'tracker', 'dual_gcn_weights.pth')

SEED = 42
TOTAL_TIMESTEPS = 250_000
CHECKPOINT_FREQ = 10_000
EVAL_EPISODES = 100
NUM_CONCEPTS = len(CONCEPTS)


def make_env():
    env = TutoringEnv(checkpoint_path=TRACKER_CHECKPOINT_PATH)
    return Monitor(env)


class EntropyDecayCallback(BaseCallback):
    """Linearly decays model.ent_coef from start_coef to end_coef over the
    next `total_steps` timesteps of THIS training call. Lets the policy
    explore broadly early and commit to what it's learned later, instead of
    a fixed entropy bonus forcing the same spread for the whole run -- which
    is what kept the policy from sharpening past ~0.28 mean mastery despite
    already exploring the full curriculum well.
    """

    def __init__(self, start_coef, end_coef, total_steps, verbose=0):
        super().__init__(verbose)
        self.start_coef = start_coef
        self.end_coef = end_coef
        self.total_steps = total_steps
        self.start_timestep = None

    def _on_training_start(self):
        self.start_timestep = self.model.num_timesteps

    def _on_step(self):
        progress = min(1.0, (self.model.num_timesteps - self.start_timestep) / self.total_steps)
        self.model.ent_coef = self.start_coef + (self.end_coef - self.start_coef) * progress
        return True


def train(total_timesteps=TOTAL_TIMESTEPS, checkpoint_freq=CHECKPOINT_FREQ, model=None, env=None,
          ent_coef_schedule=None):
    """Trains (or continues training) the PPO policy. Pass an existing
    `model`/`env` to keep building on prior progress instead of starting
    over. Saves a numbered checkpoint every `checkpoint_freq` steps to
    CHECKPOINT_DIR so behavior can be traced mid-run instead of only after
    the full budget completes. `ent_coef_schedule=(start, end)` linearly
    anneals the entropy coefficient across this call's total_timesteps.
    """
    random.seed(SEED)
    np.random.seed(SEED)

    if env is None:
        env = make_env()
    if model is None:
        model = PPO(
            "MlpPolicy",
            env,
            learning_rate=3e-4,
            n_steps=2048,
            batch_size=256,
            gamma=0.99,
            gae_lambda=0.95,
            clip_range=0.2,
            ent_coef=0.02,
            seed=SEED,
            verbose=1,
        )

    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    callbacks = [CheckpointCallback(save_freq=checkpoint_freq, save_path=CHECKPOINT_DIR, name_prefix='ppo_tutor')]
    if ent_coef_schedule is not None:
        start_coef, end_coef = ent_coef_schedule
        callbacks.append(EntropyDecayCallback(start_coef, end_coef, total_timesteps))

    print(f"Training PPO remediation agent for {total_timesteps} timesteps...")
    model.learn(total_timesteps=total_timesteps, callback=CallbackList(callbacks),
                reset_num_timesteps=(model.num_timesteps == 0))
    model.save(PPO_CHECKPOINT_PATH)
    print(f"Saved PPO policy to {PPO_CHECKPOINT_PATH}")
    return model, env


def run_episode(env, policy_fn):
    obs, info = env.reset()
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


def ppo_policy_fn(model, deterministic=False):
    # deterministic=False by default: this policy's probability distribution
    # stays fairly flat (entropy ~2.7-2.9 out of a max of ~3.2 at 25 actions)
    # even once it's learned a genuinely good strategy, so always taking the
    # argmax repeats the same mildly-favored action for an entire episode
    # and looks like collapse even when it isn't -- sampling from the actual
    # distribution is what reflects the policy PPO actually trained.
    def _policy(obs, env):
        action, _ = model.predict(obs, deterministic=deterministic)
        return int(action)
    return _policy


def random_policy_fn(obs, env):
    return env.action_space.sample()


def linear_curriculum_policy_fn():
    """Baseline: always presents the next not-yet-mastered concept in a fixed
    topological order, mirroring a standard linear curriculum with no
    adaptive remediation -- the comparison point specified in Phase 5."""
    G = build_python_dag()
    order = [CONCEPT_TO_ID[c] for c in nx.topological_sort(G)]

    def _policy(obs, env):
        cursor = getattr(_policy, "_cursor", 0)
        action = order[cursor % len(order)]
        _policy._cursor = cursor + 1
        return action

    _policy._cursor = 0
    return _policy


def weakest_belief_policy_fn(obs, env):
    """Baseline/imitation-expert policy: always target the concept the
    tracker currently believes is weakest. Unlike linear_curriculum_policy_fn
    (which picks from an internal step counter, independent of the
    observation), this action IS a genuine function of `obs` -- required for
    behavior cloning to have anything consistent to learn (see
    imitation_pretrain's docstring for why the cursor-based policy failed
    at this).

    KNOWN FAILURE MODE (diagnosed, not fixed here): belief alone can't tell
    "genuinely weak" from "prerequisite-blocked" during cold start, so this
    policy can get stuck hammering a concept whose true mastery ceiling is
    0 for an entire episode -- confirmed by direct trace. Kept as-is
    (rather than patched to use TutoringEnv's newer prereq_attempted
    feature) specifically so it stays a clean negative baseline to compare
    the structure-aware policies against. Only reads the belief block
    (obs[:NUM_CONCEPTS]) since TutoringEnv's observation is now
    [belief | prereq_attempted | visit_count], not belief alone.
    """
    return int(np.argmin(obs[:NUM_CONCEPTS]))


def structure_aware_policy_fn(obs, env):
    """Deployable heuristic baseline: weakest belief among concepts whose
    prereq_attempted flag is set (see TutoringEnv's observation layout: obs
    is [belief | prereq_attempted | visit_count]), falling back to globally
    weakest belief if none qualify yet.

    Unlike an earlier belief-threshold version of this idea (weakest belief
    among concepts whose prerequisites' BELIEF was >= 0.5), prereq_attempted
    is ground-truth bookkeeping, not a tracker prediction, so it isn't fooled
    by cold-start miscalibration -- the belief-threshold version was traced
    getting stuck hammering "Variables" for 22 straight steps because
    cold-start belief falsely read its prerequisites as already satisfied.
    """
    belief = obs[:NUM_CONCEPTS]
    prereq_attempted = obs[NUM_CONCEPTS:2 * NUM_CONCEPTS]
    eligible = [i for i in range(NUM_CONCEPTS) if prereq_attempted[i] >= 0.5]
    pool = eligible if eligible else list(range(NUM_CONCEPTS))
    return int(min(pool, key=lambda i: belief[i]))


def collect_expert_trajectories(env, policy_fn, num_episodes):
    """Runs `policy_fn` through the environment and records every
    (observation, action) pair seen -- the training set for imitation
    pretraining below."""
    observations, actions = [], []
    for _ in range(num_episodes):
        obs, info = env.reset()
        terminated = truncated = False
        while not (terminated or truncated):
            action = policy_fn(obs, env)
            observations.append(obs.copy())
            actions.append(action)
            obs, reward, terminated, truncated, info = env.step(action)
    return np.array(observations, dtype=np.float32), np.array(actions, dtype=np.int64)


def imitation_pretrain(model, observations, actions, epochs=15, batch_size=256, verbose=True):
    """Supervised pretraining of the PPO policy network to imitate expert
    (observation, action) pairs via cross-entropy, before any RL reward is
    involved. The point: give PPO a sane starting policy (matching the
    linear-curriculum baseline) instead of discovering a valid concept
    ordering through random exploration from scratch -- PPO's job during
    the RL fine-tuning phase that follows becomes learning where to
    DEVIATE from that baseline (skip mastered concepts, reprioritize),
    which is a much smaller search than discovering an ordering blind.
    """
    device = model.policy.device
    obs_tensor = torch.as_tensor(observations, device=device)
    action_tensor = torch.as_tensor(actions, device=device)
    n = len(observations)
    optimizer = model.policy.optimizer

    for epoch in range(epochs):
        perm = torch.randperm(n)
        total_loss = 0.0
        for start in range(0, n, batch_size):
            idx = perm[start:start + batch_size]
            batch_obs = obs_tensor[idx]
            batch_actions = action_tensor[idx]

            dist = model.policy.get_distribution(batch_obs)
            log_probs = dist.distribution.log_prob(batch_actions)
            loss = -log_probs.mean()

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(idx)

        if verbose:
            print(f"  imitation epoch {epoch + 1}/{epochs} | avg NLL: {total_loss / n:.4f}")
    return model


def train_with_imitation_warmstart(imitation_episodes=200, imitation_epochs=15,
                                    rl_timesteps=TOTAL_TIMESTEPS, checkpoint_freq=CHECKPOINT_FREQ,
                                    ent_coef_schedule=None):
    """Full pipeline: collect weakest-belief expert trajectories,
    imitation-pretrain a fresh PPO policy on them, then switch to normal
    RL fine-tuning (train()) from that warm-started policy instead of a
    random initialization. Uses weakest_belief_policy_fn as the imitation
    target, not linear_curriculum_policy_fn -- the latter's action doesn't
    depend on the observation (see its own docstring), so there is nothing
    consistent for behavior cloning to learn from it.
    """
    random.seed(SEED)
    np.random.seed(SEED)

    env = make_env()
    model = PPO(
        "MlpPolicy", env,
        learning_rate=3e-4, n_steps=2048, batch_size=256,
        gamma=0.99, gae_lambda=0.95, clip_range=0.2, ent_coef=0.02,
        seed=SEED, verbose=1,
    )

    print(f"Collecting {imitation_episodes} weakest-belief expert episodes...")
    expert_env = TutoringEnv(checkpoint_path=TRACKER_CHECKPOINT_PATH)
    observations, actions = collect_expert_trajectories(
        expert_env, weakest_belief_policy_fn, imitation_episodes
    )
    print(f"Collected {len(observations)} (obs, action) pairs.")

    print("Imitation pretraining...")
    imitation_pretrain(model, observations, actions, epochs=imitation_epochs)

    print("Switching to PPO reinforcement-learning fine-tuning...")
    return train(total_timesteps=rl_timesteps, checkpoint_freq=checkpoint_freq,
                 model=model, env=env, ent_coef_schedule=ent_coef_schedule)


def evaluate_policies(tracker_checkpoint=TRACKER_CHECKPOINT_PATH, episodes=EVAL_EPISODES, ppo_model=None):
    results = {}

    for name, policy_builder in [
        ("random", lambda: random_policy_fn),
        ("linear_curriculum", linear_curriculum_policy_fn),
    ]:
        env = TutoringEnv(checkpoint_path=tracker_checkpoint)
        policy = policy_builder()
        episode_logs = [run_episode(env, policy) for _ in range(episodes)]
        results[name] = summarize(episode_logs)

    if ppo_model is not None:
        env = TutoringEnv(checkpoint_path=tracker_checkpoint)
        policy = ppo_policy_fn(ppo_model)
        episode_logs = [run_episode(env, policy) for _ in range(episodes)]
        results["ppo"] = summarize(episode_logs)

    return results


def summarize(episode_logs):
    mastered = [e for e in episode_logs if e["reached_mastery"]]
    success_rate = len(mastered) / len(episode_logs)
    mean_steps_to_mastery = float(np.mean([e["steps"] for e in mastered])) if mastered else float("nan")
    mean_final_mastery = float(np.mean([e["final_avg_mastery"] for e in episode_logs]))
    return {
        "success_rate": success_rate,
        "mean_steps_to_mastery": mean_steps_to_mastery,
        "mean_final_avg_mastery": mean_final_mastery,
    }


def main():
    model, _ = train()

    print(f"\nEvaluating PPO vs. baselines over {EVAL_EPISODES} episodes each...")
    results = evaluate_policies(ppo_model=model)

    print("\n--- Remediation Efficiency (Steps-to-Mastery) ---")
    for name, metrics in results.items():
        print(
            f"{name:>18}: success_rate={metrics['success_rate']:.2%} | "
            f"mean_steps_to_mastery={metrics['mean_steps_to_mastery']:.1f} | "
            f"mean_final_avg_mastery={metrics['mean_final_avg_mastery']:.3f}"
        )


if __name__ == "__main__":
    main()
