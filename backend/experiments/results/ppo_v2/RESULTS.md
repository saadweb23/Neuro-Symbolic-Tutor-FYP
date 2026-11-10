# PPO remediation agent - evaluation

All policies play the SAME 200 seeded simulated students (never used for training or checkpoint selection).

- **Attainment**: final average true mastery / the most that student could ever reach (their prerequisite-gated ceiling).
- **Efficiency**: attainment averaged over the 150-step budget (higher = learns faster).
- **Success among students who can succeed**: reaching 0.65 average mastery, counting only the 15.5% of students for whom 0.65 is reachable at all.

## Results

| Policy | Attainment | Efficiency [95% CI] | Success among students who can succeed | Steps to reach 80% | Efficiency vs linear (paired, same students) |
|---|---|---|---|---|---|
| Greedy reference (sees hidden true state) | 98.4% | 0.875 [0.863, 0.887] | 96.8% | 32.9 | +0.043 [+0.032, +0.054] |
| Linear curriculum (simple baseline) | 97.3% | 0.833 [0.815, 0.850] | 96.8% | 44.6 | +0.000 [+0.000, +0.000] |
| **PPO v2, run 4: new tracker + accurate warm start** | 97.3% | 0.833 [0.815, 0.850] | 96.8% | 44.6 | -0.000 [-0.000, +0.000] |
| PPO, run 5: original tracker + accurate warm start | 97.3% | 0.833 [0.815, 0.850] | 96.8% | 44.6 | +0.000 [+0.000, +0.000] |
| PPO, run 1: new tracker + rough warm start | 96.8% | 0.791 [0.775, 0.807] | 71.0% | 54.6 | -0.041 [-0.050, -0.033] |
| PPO, run 2: original tracker + rough warm start | 96.9% | 0.790 [0.772, 0.806] | 71.0% | 56.0 | -0.043 [-0.051, -0.035] |
| PPO, run 3: new tracker, no warm start | 94.0% | 0.738 [0.719, 0.755] | 51.6% | 69.8 | -0.095 [-0.107, -0.085] |
| Existing PPO (before this work) | 94.9% | 0.740 [0.724, 0.755] | 54.8% | 68.7 | -0.093 [-0.104, -0.081] |
| Random | 85.0% | 0.493 [0.468, 0.517] | 22.6% | 115.9 | -0.340 [-0.359, -0.321] |

## What was found
1. **The old success-rate metric was dominated by which students were drawn.** Only ~15% of simulated students can ever reach the 0.65 success threshold (mean reachable mastery 0.327), so success rate is capped near 15% for every policy.
2. **The existing PPO was genuinely behind** the simple linear curriculum (efficiency 0.740 vs 0.833), not just on a misleading metric.
3. **The improvement came from fixing the warm start**, not from the new tracker: runs with the original and the new tracker score the same (0.790 vs 0.791 for the rough warm start; run 3 without a warm start, 0.738, equals the old PPO). The earlier warm start copied "weakest belief", a policy known to get stuck on blocked concepts; the new one copies a sweep in curriculum order.
4. **PPO now matches, but does not beat, the linear curriculum.** With an accurate warm start (imitation loss 0.0008) the policy equals the linear curriculum's score, and 250,000 further reinforcement-learning steps found no improvement on validation students.
5. **Why RL finds nothing more to gain:** the gap to the greedy reference (+0.04) needs to know when a concept has reached its hidden ceiling. Neither the tracker's beliefs (tested with 6 skip rules, either tracker) nor each concept's recent pass/fail record (5 skip rules) beats the plain sweep.
6. **The new tracker's beliefs are safe to act on; the original's are not**: belief-based skipping costs up to 0.09 efficiency with the original tracker but is neutral with the new one.
