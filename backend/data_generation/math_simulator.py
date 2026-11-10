import csv
import math
import random
import os
import sys
import networkx as nx

# Add the root directory to the path so we can import the graph
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from knowledge_graph.graph_builder import python_kg

RANDOM_SEED = 42

# Each profile now describes a DISTRIBUTION (mean, concentration) that individual
# students are sampled from, rather than a single fixed constant shared by every
# student in the archetype. Concentration controls spread: higher = tighter
# clustering around the mean, lower = more individual variation. `learn_rate` is
# the BKT transition probability (chance mastery increases after an attempt);
# `forget_rate` is the per-step decay applied to a prerequisite's mastery for
# every step that elapses since it was last practiced.
LEARNER_PROFILES = {
    "Fast Learner": {
        "base_mastery_mean": 0.85, "base_mastery_conc": 20,
        "slip_mean": 0.05, "slip_conc": 40,
        "guess_mean": 0.20, "guess_conc": 25,
        "learn_mean": 0.55, "learn_conc": 15,
        "forget_mean": 0.03, "forget_conc": 30,
    },
    "Struggling Learner": {
        "base_mastery_mean": 0.40, "base_mastery_conc": 12,
        "slip_mean": 0.25, "slip_conc": 20,
        "guess_mean": 0.10, "guess_conc": 20,
        "learn_mean": 0.20, "learn_conc": 15,
        "forget_mean": 0.12, "forget_conc": 20,
    },
    "Forgetful Learner": {
        "base_mastery_mean": 0.60, "base_mastery_conc": 15,
        "slip_mean": 0.15, "slip_conc": 25,
        "guess_mean": 0.15, "guess_conc": 20,
        "learn_mean": 0.40, "learn_conc": 15,
        "forget_mean": 0.25, "forget_conc": 15,
    },
}


def sample_beta(mean, concentration):
    mean = min(max(mean, 1e-3), 1 - 1e-3)
    alpha = mean * concentration
    beta = (1 - mean) * concentration
    return random.betavariate(alpha, beta)


def sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))


def logit(p):
    p = min(max(p, 1e-6), 1 - 1e-6)
    return math.log(p / (1 - p))


def compute_concept_difficulty(graph, scale=1.5):
    """IRT-style difficulty per concept, derived from curriculum depth: concepts
    that sit deeper in the prerequisite DAG are intrinsically harder for every
    student, independent of their learner profile."""
    generations = list(nx.topological_generations(graph))
    max_layer = max(1, len(generations) - 1)
    difficulty = {}
    for layer_idx, nodes in enumerate(generations):
        level_difficulty = (layer_idx / max_layer) * scale
        for node in nodes:
            difficulty[node] = level_difficulty
    return difficulty


def generate_math_trajectory(student_id, profile_name, graph, concept_difficulty):
    profile = LEARNER_PROFILES[profile_name]
    learning_path = list(nx.topological_sort(graph))

    # Individual traits sampled once per student, around the profile's distribution
    base_mastery = sample_beta(profile["base_mastery_mean"], profile["base_mastery_conc"])
    slip_rate = sample_beta(profile["slip_mean"], profile["slip_conc"])
    guess_rate = sample_beta(profile["guess_mean"], profile["guess_conc"])
    learn_rate = sample_beta(profile["learn_mean"], profile["learn_conc"])
    forget_rate = sample_beta(profile["forget_mean"], profile["forget_conc"])

    mastery = {}
    practiced_step = {}
    trajectory = []
    oracle_rows = []

    for step_id, concept in enumerate(learning_path, start=1):
        prereqs = list(graph.predecessors(concept))

        # Prior knowledge entering this attempt: prerequisites decay the longer
        # it's been since they were last practiced, and a weak prerequisite gates
        # progress more than a simple average would (weakest-link weighting).
        if not prereqs:
            prior_knowledge = base_mastery
        else:
            effective_prereqs = []
            for p in prereqs:
                elapsed = step_id - practiced_step[p]
                decayed = mastery[p] * ((1 - forget_rate) ** elapsed)
                effective_prereqs.append(decayed)
            prereq_component = 0.5 * (sum(effective_prereqs) / len(effective_prereqs)) + 0.5 * min(effective_prereqs)
            prior_knowledge = prereq_component * base_mastery

        # IRT-style adjustment: deeper/harder concepts lower the effective
        # probability of actually "having" the concept this attempt.
        difficulty = concept_difficulty[concept]
        p_know_effective = sigmoid(logit(prior_knowledge) - difficulty)

        # BKT emission model: did the student actually know it this time?
        covered = random.random() < p_know_effective
        if covered:
            passed = 0 if random.random() < slip_rate else 1
        else:
            passed = 1 if random.random() < guess_rate else 0

        # Response time correlates with the underlying mechanism, not just the
        # outcome: a lucky guess is fast, a genuine slip-up is slow, a confident
        # correct answer is quick, a real struggle drags on.
        if covered and passed == 1:
            time_mu = 32
        elif covered and passed == 0:
            time_mu = 68
        elif not covered and passed == 1:
            time_mu = 16
        else:
            time_mu = 52
        time_taken = int(min(max(random.lognormvariate(math.log(time_mu), 0.35), 8), 280))

        trajectory.append({
            "student_id": student_id,
            "profile": profile_name,
            "step": step_id,
            "concept": concept,
            "passed": passed,
            "time_taken": time_taken,
        })

        # Bayes-optimal pass probability for this exact attempt, computable only
        # because we (the generator) know the true latent state. Logged separately
        # for ceiling analysis -- never fed into the training CSV.
        true_pass_prob = p_know_effective * (1 - slip_rate) + (1 - p_know_effective) * guess_rate
        oracle_rows.append({
            "student_id": student_id,
            "step": step_id,
            "concept": concept,
            "true_pass_prob": true_pass_prob,
        })

        # BKT transition: mastery has a chance to improve from this exposure,
        # regardless of whether the attempt itself succeeded.
        mastery[concept] = prior_knowledge + (1 - prior_knowledge) * learn_rate
        practiced_step[concept] = step_id

    return trajectory, oracle_rows


def build_math_dataset(num_students=1000, output_file="generated_logs.csv", oracle_file="generated_logs_oracle.csv"):
    random.seed(RANDOM_SEED)

    current_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(current_dir, output_file)
    oracle_path = os.path.join(current_dir, oracle_file)

    concept_difficulty = compute_concept_difficulty(python_kg)

    all_logs = []
    all_oracle_rows = []
    profiles = list(LEARNER_PROFILES.keys())

    print(f"Generating {num_students} synthetic student trajectories using Math Simulator...")

    for i in range(1, num_students + 1):
        assigned_profile = random.choice(profiles)
        student_path, oracle_rows = generate_math_trajectory(
            f"STU_{i:04d}", assigned_profile, python_kg, concept_difficulty
        )
        all_logs.extend(student_path)
        all_oracle_rows.extend(oracle_rows)

    keys = all_logs[0].keys()
    with open(out_path, 'w', newline='') as output_csv:
        dict_writer = csv.DictWriter(output_csv, fieldnames=keys)
        dict_writer.writeheader()
        dict_writer.writerows(all_logs)

    oracle_keys = all_oracle_rows[0].keys()
    with open(oracle_path, 'w', newline='') as oracle_csv:
        dict_writer = csv.DictWriter(oracle_csv, fieldnames=oracle_keys)
        dict_writer.writeheader()
        dict_writer.writerows(all_oracle_rows)

    print(f"Success! Saved {len(all_logs)} interaction logs to {out_path}")
    print(f"Saved ceiling-analysis oracle probabilities to {oracle_path} (diagnostics only, not for training)")


if __name__ == "__main__":
    build_math_dataset(2500)
