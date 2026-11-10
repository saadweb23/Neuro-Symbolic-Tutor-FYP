"""PPO training against a chosen tracker, with fixes for the earlier attempts' problems.

What changed and why (see experiments/logs/ for the earlier attempts):
- Checkpoints are selected by ATTAINMENT on held-out validation students
  (agent/policy_evaluation.py), not by training reward or the 0.65 success
  rate, which is capped at ~15% by what students can reach.
- Optional imitation warm start from a SWEEP expert (a pure function of the
  observation: least-visited concept in curriculum order). The earlier warm start
  imitated "weakest belief", a policy known to get stuck on blocked concepts.
  Expert actions are recorded on noisy rollouts so the network also sees states
  off the expert's own path.
- Parallel environments (SubprocVecEnv) for throughput.
- Never overwrites the live agent/ppo_tutor.zip: outputs go to
  agent/ppo_v2_runs/<name>/.

    python agent/ppo_trainer_v2.py --name v2_imit --tracker tracker/dual_gcn_weights_v2.pth
"""
import argparse
import json
import os
import random
import sys
import time
from functools import partial

import numpy as np
import torch

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BACKEND)
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback, CallbackList
from stable_baselines3.common.monitor import Monitor
from stable_baselines3.common.vec_env import SubprocVecEnv

from agent import policy_evaluation as pe
from agent.ppo_trainer import EntropyDecayCallback
from agent.tutoring_env import TutoringEnv

RUNS_DIR = os.path.join(BACKEND, "agent", "ppo_v2_runs")
VALIDATION_SEEDS = list(range(50000, 50040))      # disjoint from the test seeds (100000+)


def make_env(tracker_path):
    torch.set_num_threads(1)
    return Monitor(TutoringEnv(checkpoint_path=tracker_path))


class AttainmentCheckpoint(BaseCallback):
    """Every `every` timesteps: score the current policy on the validation
    students and keep the best one (by mean attainment over the budget)."""

    def __init__(self, tracker_path, every, save_path, log):
        super().__init__()
        self.env = TutoringEnv(checkpoint_path=tracker_path)
        self.every, self.save_path, self.log = every, save_path, log
        self.last, self.best, self.history = 0, -1.0, []

    def _evaluate(self):
        eps = pe.run_paired(self.env, lambda: pe.ppo_policy(self.model), VALIDATION_SEEDS)
        s = pe.summarize(eps)
        return s["efficiency"][0], s["attainment"][0]

    def _on_step(self):
        if self.num_timesteps - self.last < self.every:
            return True
        self.last = self.num_timesteps
        eff, att = self._evaluate()
        self.history.append({"timesteps": int(self.num_timesteps), "val_efficiency": eff, "val_attainment": att})
        marker = ""
        if eff > self.best:
            self.best = eff
            self.model.save(self.save_path)
            marker = "  <- new best, saved"
        self.log(f"  [{self.num_timesteps:>7,} steps] validation efficiency {eff:.4f} | attainment {att:.4f}{marker}")
        return True


def collect_sweep_demonstrations(tracker_path, episodes, noise, log):
    """(observation, expert action) pairs. With probability `noise` the executed action is random
    (the label stays the expert's choice for that state), so states off the expert's path are covered."""
    env = TutoringEnv(checkpoint_path=tracker_path)
    expert = pe.sweep_policy
    obs_list, act_list = [], []
    for ep in range(episodes):
        obs, _ = env.reset(seed=900000 + ep)
        policy = expert()
        done = False
        while not done:
            label = policy(obs, env)
            obs_list.append(obs.copy()); act_list.append(label)
            action = int(env.action_space.sample()) if random.random() < noise else label
            obs, _, term, trunc, _ = env.step(action)
            done = term or trunc
    log(f"  collected {len(obs_list):,} demonstrations from {episodes} episodes")
    return np.array(obs_list, dtype=np.float32), np.array(act_list, dtype=np.int64)


def imitation_pretrain(model, observations, actions, epochs, lr, log, batch_size=256):
    optimizer = model.policy.optimizer
    for g in optimizer.param_groups:
        g["lr"] = lr
    obs_t, act_t = torch.as_tensor(observations), torch.as_tensor(actions)
    n = len(observations)
    for epoch in range(1, epochs + 1):
        perm, total = torch.randperm(n), 0.0
        for start in range(0, n, batch_size):
            idx = perm[start:start + batch_size]
            dist = model.policy.get_distribution(obs_t[idx])
            loss = -dist.distribution.log_prob(act_t[idx]).mean()
            optimizer.zero_grad(); loss.backward(); optimizer.step()
            total += loss.item() * len(idx)
        if epoch % 5 == 0 or epoch == 1:
            log(f"  imitation epoch {epoch}/{epochs} | NLL {total / n:.4f}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--tracker", default="tracker/dual_gcn_weights_v2.pth")
    ap.add_argument("--timesteps", type=int, default=300_000)
    ap.add_argument("--envs", type=int, default=4)
    ap.add_argument("--no-imitation", action="store_true")
    ap.add_argument("--imitation-episodes", type=int, default=120)
    ap.add_argument("--imitation-epochs", type=int, default=30)
    ap.add_argument("--imitation-noise", type=float, default=0.15)
    ap.add_argument("--imitation-lr", type=float, default=3e-4)
    ap.add_argument("--net", default="64,64", help="hidden layer sizes of the policy and value networks")
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--ent-start", type=float, default=0.01)
    ap.add_argument("--ent-end", type=float, default=0.001)
    ap.add_argument("--eval-every", type=int, default=30_000)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    out_dir = os.path.join(RUNS_DIR, args.name)
    os.makedirs(out_dir, exist_ok=True)
    log_file = open(os.path.join(out_dir, "train.log"), "a", buffering=1)

    def log(msg):
        print(msg, flush=True)
        log_file.write(msg + "\n")

    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)
    tracker_path = os.path.join(BACKEND, args.tracker)
    log(f"run {args.name}: tracker={args.tracker} imitation={not args.no_imitation} timesteps={args.timesteps:,}")

    env = SubprocVecEnv([partial(make_env, tracker_path) for _ in range(args.envs)])
    model = PPO("MlpPolicy", env, learning_rate=args.lr, n_steps=2048 // args.envs, batch_size=256,
                gamma=0.99, gae_lambda=0.95, clip_range=0.2, ent_coef=args.ent_start,
                seed=args.seed, verbose=0, device="cpu",
                policy_kwargs={"net_arch": [int(x) for x in args.net.split(",")]})
    t0 = time.time()

    if not args.no_imitation:
        log("collecting sweep-expert demonstrations...")
        obs, acts = collect_sweep_demonstrations(tracker_path, args.imitation_episodes, args.imitation_noise, log)
        log("imitation pretraining...")
        imitation_pretrain(model, obs, acts, args.imitation_epochs, lr=args.imitation_lr, log=log)
        for g in model.policy.optimizer.param_groups:
            g["lr"] = args.lr
        probe = AttainmentCheckpoint(tracker_path, 1, os.path.join(out_dir, "imitation_only.zip"), log)
        probe.model = model
        eff, att = probe._evaluate()
        log(f"  after imitation only: validation efficiency {eff:.4f} | attainment {att:.4f}")
        model.save(os.path.join(out_dir, "imitation_only.zip"))

    best_path = os.path.join(out_dir, "best.zip")
    checkpoint = AttainmentCheckpoint(tracker_path, args.eval_every, best_path, log)
    if not args.no_imitation:
        # the warm-started policy itself is a candidate: RL must beat it on validation to replace it
        checkpoint.best = eff
        model.save(best_path)
    log("reinforcement-learning fine-tuning...")
    model.learn(total_timesteps=args.timesteps,
                callback=CallbackList([checkpoint, EntropyDecayCallback(args.ent_start, args.ent_end, args.timesteps)]))
    model.save(os.path.join(out_dir, "last.zip"))
    minutes = (time.time() - t0) / 60
    with open(os.path.join(out_dir, "history.json"), "w") as f:
        json.dump({"args": vars(args), "minutes": minutes, "validation": checkpoint.history,
                   "best_validation_efficiency": checkpoint.best}, f, indent=2)
    log(f"done in {minutes:.1f} min | best validation efficiency {checkpoint.best:.4f} -> {best_path}")
    env.close()


if __name__ == "__main__":
    main()
