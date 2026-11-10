"""Generates additional simulated students with the SAME simulator and
parameters as generated_logs.csv, but with different random seeds, so they
are new students rather than copies.

    train_extra  -- more training data for the tracker
    fresh_test   -- a larger held-out test set, never used for training or
                    model selection, for tighter confidence intervals than
                    the original 250-student test split

Output goes to data_generation/extra/ (gitignored: fully reproducible from
the seeds below). math_simulator.build_math_dataset() always re-seeds with 42,
so calling it again would just regenerate the original students.
"""
import csv
import os
import random
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data_generation.math_simulator import (
    LEARNER_PROFILES, compute_concept_difficulty, generate_math_trajectory,
)
from knowledge_graph.graph_builder import python_kg

EXTRA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "extra")

# noise_scale multiplies every profile's mean slip and guess rate -- the two
# sources of label noise that set the Bayes-optimal (oracle) AUC ceiling.
# 1.0 is the original simulator. The noise_* sets are for the data-noise
# SENSITIVITY STUDY only: same size and seeds style, different noise level, so
# model AUC can be compared against each set's own ceiling.
DATASETS = {
    "train_extra": {"num_students": 6000, "seed": 1001},
    "fresh_test": {"num_students": 1000, "seed": 2002},
    "noise_low": {"num_students": 3000, "seed": 3001, "noise_scale": 0.5},
    "noise_orig": {"num_students": 3000, "seed": 3002, "noise_scale": 1.0},
    "noise_high": {"num_students": 3000, "seed": 3003, "noise_scale": 1.5},
}


def generate(name, num_students, seed, noise_scale=1.0):
    random.seed(seed)
    original_rates = {p: (cfg["slip_mean"], cfg["guess_mean"]) for p, cfg in LEARNER_PROFILES.items()}
    for cfg in LEARNER_PROFILES.values():
        cfg["slip_mean"] *= noise_scale
        cfg["guess_mean"] *= noise_scale

    concept_difficulty = compute_concept_difficulty(python_kg)
    profiles = list(LEARNER_PROFILES.keys())

    logs, oracle = [], []
    try:
        for i in range(1, num_students + 1):
            profile = random.choice(profiles)
            trajectory, oracle_rows = generate_math_trajectory(
                f"{name.upper()}_{i:05d}", profile, python_kg, concept_difficulty)
            logs.extend(trajectory)
            oracle.extend(oracle_rows)
    finally:
        for p, (slip, guess) in original_rates.items():
            LEARNER_PROFILES[p]["slip_mean"], LEARNER_PROFILES[p]["guess_mean"] = slip, guess

    os.makedirs(EXTRA_DIR, exist_ok=True)
    for rows, suffix in ((logs, ".csv"), (oracle, "_oracle.csv")):
        path = os.path.join(EXTRA_DIR, name + suffix)
        with open(path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
    print(f"{name}: {num_students} students, {len(logs)} interactions -> {EXTRA_DIR}")


if __name__ == "__main__":
    for dataset_name, cfg in DATASETS.items():
        generate(dataset_name, **cfg)
