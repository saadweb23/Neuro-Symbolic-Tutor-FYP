"""Evaluates ONE policy on the paired seeded students and saves its episodes.

    python experiments/run_policy_eval.py --policy linear --out linear
    python experiments/run_policy_eval.py --policy ppo --ppo agent/ppo_tutor.zip --tracker tracker/dual_gcn_weights_v1.pth --out ppo_old
"""
import argparse
import json
import os
import sys

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BACKEND)
import torch
from agent import policy_evaluation as pe
from agent.tutoring_env import TutoringEnv

OUT_DIR = os.path.join(BACKEND, "experiments", "results", "ppo_v2", "policy_eval")
EVAL_SEEDS = list(range(100000, 100200))     # fixed, disjoint from anything used for training


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--policy", required=True,
                    choices=["random", "linear", "structure", "sweep", "greedy", "ppo"])
    ap.add_argument("--ppo", default="agent/ppo_tutor.zip")
    ap.add_argument("--tracker", default="tracker/dual_gcn_weights.pth")
    ap.add_argument("--episodes", type=int, default=len(EVAL_SEEDS))
    ap.add_argument("--deterministic", action="store_true")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    torch.set_num_threads(1)

    env = TutoringEnv(checkpoint_path=os.path.join(BACKEND, args.tracker))
    if args.policy == "ppo":
        from stable_baselines3 import PPO
        model = PPO.load(os.path.join(BACKEND, args.ppo), device="cpu")
        builder = lambda: pe.ppo_policy(model, deterministic=args.deterministic)
    else:
        builder = {"random": pe.random_policy, "linear": pe.linear_curriculum_policy,
                   "structure": pe.structure_aware_policy, "sweep": pe.sweep_policy,
                   "greedy": pe.greedy_oracle_policy}[args.policy]

    episodes = pe.run_paired(env, builder, EVAL_SEEDS[:args.episodes])
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, args.out + ".json"), "w") as f:
        json.dump({"policy": args.policy, "tracker": args.tracker, "ppo": args.ppo if args.policy == "ppo" else None,
                   "episodes": episodes, "summary": pe.summarize(episodes)}, f)
    s = pe.summarize(episodes)
    print(f"[{args.out}] attainment {s['attainment'][0]:.3f} | efficiency {s['efficiency'][0]:.3f} | "
          f"success {s['success_rate']:.1%} (feasible-only {s['success_rate_feasible']:.1%}) | feasible share {s['feasible_share']:.1%}", flush=True)


if __name__ == "__main__":
    main()
