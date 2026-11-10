"""python experiments/app_session_test.py [blocks]   e.g. 0,1,2
Full simulated sessions through the REAL serving code (throwaway DB), old model pair vs new pair."""
import os, sys, tempfile, numpy as np
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, B); os.chdir(B)
from stable_baselines3 import PPO
from serving import persistence
from serving.content_engine import recommend_content, submit_mcq_answer, SESSION_ROUND_CAP_DEFAULT
from serving.placement_quiz import run_placement_quiz, PLACEMENT_CONCEPTS
from knowledge_graph.graph_builder import CONCEPT_BLOCKS

PAIRS = {"OLD pair": (f"{B}/tracker/dual_gcn_weights_v1.pth", f"{B}/agent/ppo_tutor.zip"),
         "NEW pair": (f"{B}/tracker/dual_gcn_weights_v2.pth", f"{B}/agent/ppo_tutor_v2.zip")}
PPOS = {k: PPO.load(v[1]) for k, v in PAIRS.items()}

def run(pair, block, p, seed, max_rounds=30):
    ckpt = PAIRS[pair][0]; ppo = PPOS[pair]; rng = np.random.RandomState(seed)
    db = os.path.join(tempfile.mkdtemp(), "t.db"); sid = "s"
    pl = [{"concept": c, "passed": int(rng.rand() < p), "time_taken": 12.0} for c in PLACEMENT_CONCEPTS]
    b0 = run_placement_quiz(sid, pl, db_path=db, checkpoint_path=ckpt)
    conn = persistence.init_db(db); persistence.start_session(conn, sid, block, SESSION_ROUND_CAP_DEFAULT); conn.close()
    seq, end = [], None
    for r in range(max_rounds):
        rec = recommend_content(sid, ppo, db_path=db, tracker_checkpoint_path=ckpt)
        k = rec["content_type"]
        if k in ("complete", "block_complete", "session_paused"):
            end = (k, r, rec["content"]); break
        seq.append(f'{rec["concept"]}:{k[:5]}')
        conn = persistence.init_db(db)
        if k == "practice_problem":
            pay = persistence.get_generated_question(conn, rec["content"]["id"]); conn.close()
            ok = rng.rand() < p
            submit_mcq_answer(sid, rec["content"]["id"], pay["correct_index"] if ok else (pay["correct_index"]+1)%4, 10.0, db_path=db, tracker_checkpoint_path=ckpt)
        else:
            step = persistence.get_next_step_index(conn, sid)
            persistence.log_interaction(conn, sid, step, rec["concept"], 1, 20.0, source="tutoring", content_id=rec["content"]["id"]); conn.close()
    conn = persistence.init_db(db); hist = persistence.get_interaction_history(conn, sid); conn.close()
    attempted = {h["concept"] for h in hist}
    blk = CONCEPT_BLOCKS[block]["concepts"]
    return b0, seq, end, [c for c in blk if c not in attempted]

if __name__ == "__main__":
    blocks = [int(x) for x in sys.argv[1].split(",")] if len(sys.argv) > 1 else [0, 1, 2, 3, 4]
    for label, p in (("STRONG (95% right)", .95), ("MIXED (60%)", .6), ("WEAK (20%)", .2)):
        print(f"\n##### {label}")
        for blk in blocks:
            for pair in PAIRS:
                b0, seq, end, unvisited = run(pair, blk, p, seed=blk)
                avg0 = np.mean(list(b0.values())); min0 = min(b0.values())
                e = f"{end[0]} @round {end[1]}" if end else f"running after {len(seq)} rounds"
                print(f"block{blk} {pair}: post-placement avg {avg0:.2f} min {min0:.2f} | {e} | block concepts never attempted: {len(unvisited)} | first 6: {seq[:6]}")
