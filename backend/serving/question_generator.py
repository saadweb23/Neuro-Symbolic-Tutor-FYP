import json
import os
import random

import google.generativeai as genai
from dotenv import load_dotenv

# Same Gemini setup already used in data_generation/llm_simulator.py, reused
# here for consistency rather than introducing a second LLM integration path.
load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# Set MOCK_LLM=true in the environment to skip real Gemini calls entirely and
# get instant, free, varied placeholder questions instead -- for frontend/API
# development, where the same flow gets tested dozens of times per session.
# Unset (or MOCK_LLM=false) for the real thing, e.g. for a final evaluation.
MOCK_MODE = os.environ.get("MOCK_LLM", "false").lower() == "true"

# Set USE_QUESTION_BANK=true to serve pre-generated, real Gemini-authored
# questions from the static bank (data_generation/build_question_bank.py)
# instead of calling the API live -- for a live demonstration, where network
# dependency, per-call latency, and the risk of a malformed question landing
# live are all unacceptable, but placeholder [MOCK] text is just as bad in
# front of an audience. Takes priority over MOCK_MODE when both are set.
USE_QUESTION_BANK = os.environ.get("USE_QUESTION_BANK", "false").lower() == "true"
QUESTION_BANK_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data_generation", "question_bank.json"
)

_model = None
_question_bank = None


def _get_model():
    global _model
    if _model is None:
        # gemini-2.5-flash is being retired (Google's API now rejects it for
        # this project with a 404 pointing here) and its free tier was also
        # capped at a very restrictive 20 requests/day for this key --
        # confirmed by actually hitting that quota. gemini-3.5-flash-lite is
        # Google's suggested current replacement and has real free-tier
        # headroom, verified with a live test call.
        _model = genai.GenerativeModel('gemini-3.5-flash-lite')
    return _model


def difficulty_for_belief(belief):
    """Maps the tracker's current mastery belief for a concept to a question
    difficulty tier. This is where "difficulty" actually earns its keep in
    this system: the Dual-GCN itself never sees difficulty as a feature (see
    DualGCNTracker.forward), so tiering happens here, at content-selection
    time, using the belief the tracker already computed -- weak belief gets
    an easier question, strong belief gets pushed harder.
    """
    if belief < 0.4:
        return "easy"
    if belief < 0.7:
        return "medium"
    return "hard"


def generate_mcq(concept, difficulty, avoid_questions=None):
    """Generates one multiple-choice question on `concept` at the given
    difficulty via Gemini.

    `avoid_questions` is a list of question texts already asked on this
    concept for this student, so repeated visits (which happen constantly --
    PPO revisits concepts for reinforcement) get fresh questions instead of
    the same one every time.

    MCQ format is deliberate: grading free-text would need a second LLM call
    and is unreliable to score exactly; comparing a selected index to
    `correct_index` is exact and instant.

    Returns {"question", "choices" (4 strings), "correct_index", "explanation"}.
    Raises ValueError if the model's output doesn't parse into that shape --
    callers should retry or fall back rather than serve a malformed question.
    """
    if USE_QUESTION_BANK:
        return _bank_mcq(concept, difficulty, avoid_questions)
    if MOCK_MODE:
        return _mock_mcq(concept, difficulty, avoid_questions)

    avoid_questions = avoid_questions or []
    avoid_block = ""
    if avoid_questions:
        bulleted = "\n".join(f"- {q}" for q in avoid_questions[-10:])
        avoid_block = (
            "Do NOT repeat or closely rephrase any of these questions already "
            f"asked on this concept:\n{bulleted}\n"
        )

    prompt = f"""
    You are writing one multiple-choice question for a Python programming
    tutor, on the concept: "{concept}".
    Difficulty: {difficulty} (easy = recognizing basic syntax/definitions,
    medium = applying the concept in a short code snippet, hard = predicting
    output or spotting a subtle bug involving "{concept}").
    {avoid_block}
    Output ONLY raw JSON (no markdown fences), in exactly this shape:
    {{
        "question": "the question text, including any code snippet inline using \\n for newlines",
        "choices": ["choice A", "choice B", "choice C", "choice D"],
        "correct_index": 0,
        "explanation": "one sentence on why the correct choice is correct"
    }}
    Exactly one of the four choices must be correct. correct_index is 0-based.
    """

    response = _get_model().generate_content(prompt)
    raw_text = response.text.strip().removeprefix('```json').removesuffix('```').strip()
    payload = json.loads(raw_text)

    if len(payload.get("choices", [])) != 4 or not (0 <= payload.get("correct_index", -1) < 4):
        raise ValueError(f"Malformed MCQ payload from LLM: {payload}")

    return payload


def _load_question_bank():
    global _question_bank
    if _question_bank is None:
        with open(QUESTION_BANK_PATH, encoding="utf-8") as f:
            _question_bank = json.load(f)
    return _question_bank


def _bank_mcq(concept, difficulty, avoid_questions=None):
    """Serves a pre-generated, real Gemini-authored question from the static
    offline bank instead of calling the API live. Cycles back to the first
    question for this (concept, difficulty) once all of them have already
    been asked, rather than raising -- a long demo session revisiting a
    concept more times than the bank has entries should degrade to a repeat,
    never to a crash, live in front of an audience.
    """
    avoid_questions = avoid_questions or []
    bank = _load_question_bank()
    pool = bank.get(concept, {}).get(difficulty, [])
    if not pool:
        raise ValueError(
            f"No bank questions for {concept}/{difficulty} -- run "
            "data_generation/build_question_bank.py first"
        )

    unused = [q for q in pool if q["question"] not in avoid_questions]
    return dict(unused[0] if unused else pool[0])


def _mock_mcq(concept, difficulty, avoid_questions=None):
    """Free, instant, no-network placeholder MCQ -- same shape as a real
    generated one, varied per call so frontend/UI testing still exercises
    "different question each time" behavior without spending on API calls.
    Never used unless MOCK_LLM=true is set.
    """
    avoid_questions = avoid_questions or []
    variant = random.randint(1000, 9999)
    correct_index = random.randint(0, 3)
    choices = [f"{concept} mock option {chr(65 + i)}" for i in range(4)]
    question = f"[MOCK #{variant}, {difficulty}] Sample question about {concept}."

    # Keep regenerating the variant number until it's not a repeat, mirroring
    # the real generator's avoid-repeats behavior for realistic UI testing.
    attempts = 0
    while question in avoid_questions and attempts < 20:
        variant = random.randint(1000, 9999)
        question = f"[MOCK #{variant}, {difficulty}] Sample question about {concept}."
        attempts += 1

    return {
        "question": question,
        "choices": choices,
        "correct_index": correct_index,
        "explanation": f"[MOCK] Placeholder explanation for {concept} ({difficulty}).",
    }


def grade_mcq(question_payload, selected_index):
    return int(selected_index == question_payload["correct_index"])
