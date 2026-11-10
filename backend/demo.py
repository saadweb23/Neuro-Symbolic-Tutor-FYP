import random

from stable_baselines3 import PPO

from serving import persistence
from serving.content_engine import recommend_content, submit_mcq_answer
from serving.placement_quiz import run_placement_quiz, PLACEMENT_CONCEPTS

STUDENT_ID = "DEMO_STUDENT_004"
NUM_ROUNDS = 10


def simulate_answer(mastery_belief):
    """Stand-in for a real student's response, used only for this demo --
    higher believed mastery makes a pass more likely, roughly."""
    p_pass = 0.15 + 0.7 * mastery_belief
    passed = 1 if random.random() < p_pass else 0
    time_taken = random.uniform(20, 90)
    return passed, time_taken


def simulate_mcq_choice(content_id, mastery_belief, db_path):
    """Stand-in for a real student picking an MCQ choice. A real client
    never sees correct_index (recommend_content deliberately omits it) --
    this peek exists ONLY so the simulation harness can decide whether the
    student "knows" the answer, mirroring simulate_answer's belief-based
    pass rate for the video/escalation content types.
    """
    conn = persistence.init_db(db_path)
    question = persistence.get_generated_question(conn, content_id)
    conn.close()

    p_pass = 0.15 + 0.7 * mastery_belief
    num_choices = len(question["choices"])
    if random.random() < p_pass:
        selected_index = question["correct_index"]
    else:
        wrong_indices = [i for i in range(num_choices) if i != question["correct_index"]]
        selected_index = random.choice(wrong_indices)

    time_taken = random.uniform(20, 90)
    return selected_index, time_taken


def main():
    db_path = persistence.DEFAULT_DB_PATH

    print(f"=== Placement quiz for {STUDENT_ID} ===")
    answers = [
        {"concept": c, "passed": random.choice([0, 1]), "time_taken": random.uniform(30, 90)}
        for c in PLACEMENT_CONCEPTS
    ]
    beliefs = run_placement_quiz(STUDENT_ID, answers, db_path=db_path)
    weakest = sorted(beliefs.items(), key=lambda kv: kv[1])[:3]
    print("Weakest concepts after placement:", [(c, round(p, 3)) for c, p in weakest])

    print("\n=== Loading PPO remediation agent ===")
    ppo_model = PPO.load("agent/ppo_tutor.zip")

    # recommend_content() now requires an active session scoped to one
    # curriculum block (see content_engine.py) -- block 0 for this demo.
    conn = persistence.init_db(db_path)
    persistence.start_session(conn, STUDENT_ID, block_index=0, round_cap=NUM_ROUNDS)
    conn.close()

    for round_num in range(1, NUM_ROUNDS + 1):
        rec = recommend_content(STUDENT_ID, ppo_model, db_path=db_path)
        content = rec["content"]

        print(f"\n--- Round {round_num} ---")
        print(f"PPO recommends: {rec['concept']} (current belief: {rec['mastery_belief']:.2f})")
        print(f"Why: {rec['explanation']}")

        if rec["content_type"] == "practice_problem":
            print(f"Content type: MCQ ({content['difficulty']}) -- {content['question']}")
            for i, choice in enumerate(content["choices"]):
                print(f"  {i}. {choice}")

            selected_index, time_taken = simulate_mcq_choice(content["id"], rec["mastery_belief"], db_path)
            result = submit_mcq_answer(STUDENT_ID, content["id"], selected_index, time_taken, db_path=db_path)
            print(f"Student picked: {selected_index} -> {'CORRECT' if result['passed'] else 'WRONG'} "
                  f"({time_taken:.0f}s) | correct was {result['correct_index']}: {result['explanation']}")
        else:
            print(f"Content type: {rec['content_type'].upper()} -- {content['title']} ({content['source']})")
            print(f"URL: {content['url']}")

            passed, time_taken = simulate_answer(rec["mastery_belief"])
            print(f"Student attempt: {'PASSED' if passed else 'FAILED'} ({time_taken:.0f}s)")

            conn = persistence.init_db(db_path)
            step_index = persistence.get_next_step_index(conn, STUDENT_ID)
            persistence.log_interaction(
                conn, STUDENT_ID, step_index, rec["concept"], passed, time_taken,
                source='tutoring', content_id=content["id"]
            )
            conn.close()

    print("\n=== Demo complete ===")


if __name__ == "__main__":
    main()
