"""One-time offline generation of a static MCQ bank for demo-safe serving --
no live Gemini calls during the actual demonstration, only real Gemini-authored
content. Run once (python data_generation/build_question_bank.py), review the
output JSON, then set USE_QUESTION_BANK=true in .env to serve from it.

10 questions per concept, difficulty-tiered (4 easy / 3 medium / 3 hard) to
match question_generator.difficulty_for_belief's real tiering, so the demo's
"harder question for a confident student" behavior stays genuine, not random.

Resumable and incrementally saved: the free tier for gemini-2.5-flash caps at
5 requests/minute (confirmed via a real 429 response), so 250 questions takes
50+ minutes of real wall-clock pacing regardless of how this script is
written. Rather than risk losing that much progress to any single hiccup,
every successful question is written to disk immediately, and a re-run skips
whatever's already in the file instead of starting over.
"""
import json
import os
import re
import sys
import time

# backend/ root, one level up from data_generation/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from serving import question_generator
# Force real Gemini generation for this one-time build, regardless of the
# .env MOCK_LLM setting used for everyday dev work.
question_generator.MOCK_MODE = False

from knowledge_graph.graph_builder import CONCEPTS

OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "question_bank.json")
DIFFICULTY_COUNTS = {"easy": 4, "medium": 3, "hard": 3}
MAX_RETRIES = 5
# Free tier is 5 requests/minute for gemini-2.5-flash (confirmed via a live
# 429 response) -- 13s keeps us under that with a safety margin, rather than
# the naive 1.5s this script started with, which blew through the quota by
# the 6th call.
PACE_SECONDS = 13.0


def load_bank():
    if os.path.exists(OUT_PATH):
        with open(OUT_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_bank(bank):
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(bank, f, indent=2)


def generate_one(concept, difficulty, avoid_questions):
    last_err = None
    for attempt in range(MAX_RETRIES):
        try:
            return question_generator.generate_mcq(concept, difficulty, avoid_questions=avoid_questions)
        except Exception as exc:
            last_err = exc
            # Rate-limit errors carry their own suggested wait -- honor it
            # instead of guessing, so we don't just hit the limit again.
            match = re.search(r"retry in (\d+(?:\.\d+)?)s", str(exc))
            wait = float(match.group(1)) + 3 if match else 8.0
            print(f"  retry {attempt + 1}/{MAX_RETRIES} for {concept}/{difficulty} in {wait:.0f}s: "
                  f"{str(exc)[:80]}", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"Failed to generate {concept}/{difficulty} after {MAX_RETRIES} attempts: {last_err}")


def main():
    bank = load_bank()
    total = len(CONCEPTS) * sum(DIFFICULTY_COUNTS.values())
    already_done = sum(len(bank.get(c, {}).get(d, [])) for c in CONCEPTS for d in DIFFICULTY_COUNTS)
    done = already_done
    if already_done:
        print(f"Resuming: {already_done}/{total} already in {OUT_PATH}", flush=True)

    for concept in CONCEPTS:
        bank.setdefault(concept, {"easy": [], "medium": [], "hard": []})
        asked_so_far = [q["question"] for tier in bank[concept].values() for q in tier]

        for difficulty, target_count in DIFFICULTY_COUNTS.items():
            existing = bank[concept][difficulty]
            for i in range(len(existing), target_count):
                mcq = generate_one(concept, difficulty, asked_so_far)
                bank[concept][difficulty].append(mcq)
                asked_so_far.append(mcq["question"])
                save_bank(bank)  # incremental -- a crash loses at most one call
                done += 1
                print(f"[{done}/{total}] {concept} / {difficulty} #{i + 1}: {mcq['question'][:60]!r}", flush=True)
                time.sleep(PACE_SECONDS)

    print(f"\nDone. {done} questions across {len(CONCEPTS)} concepts saved to {OUT_PATH}")


if __name__ == "__main__":
    main()
