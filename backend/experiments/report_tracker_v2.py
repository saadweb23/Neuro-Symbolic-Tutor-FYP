"""Builds the tracker evaluation report (metrics.json, RESULTS.md, figures/)
from the runs saved by tracker_job.py. Nothing here is hand-entered: every
number is recomputed from saved predictions and the held-out datasets.

    python experiments/report_tracker_v2.py
"""
import argparse
import glob
import json
import math
import os
import sys

import numpy as np
import torch

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tracker import evaluation as ev
from tracker import fast_train as ft
from tracker.baselines import HistoryModel, PriorOnly
from tracker.dual_gcn import DualGCNTracker

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS = os.path.join(BACKEND, "experiments", "results", "tracker_v2")
RUNS = os.path.join(RESULTS, "runs")
FIGS = os.path.join(RESULTS, "figures")
DATA = os.path.join(BACKEND, "data_generation")
EXTRA = os.path.join(DATA, "extra")
V1_CHECKPOINT = os.path.join(BACKEND, "tracker", "dual_gcn_weights_v1.pth")
V1_POS_WEIGHT = 2.3598  # pos_weight the original model was trained with (see train_tracker_run.log)
TARGET_AUC = 0.75
V2 = "v2 (this work)"
V1 = "v1 (original model)"


def load_runs():
    runs = {}
    for path in glob.glob(os.path.join(RUNS, "*.json")):
        with open(path) as f:
            r = json.load(f)
        r["logits"] = np.load(path.replace(".json", "_logits.npz"))
        runs[r["name"]] = r
    return runs


def fmt(x, nd=3):
    return f"{x:.{nd}f}"


def row(name, m):
    c = m["confusion"]
    return (f"| {name} | {fmt(m['auc'])} [{fmt(m['auc_ci95'][0])}, {fmt(m['auc_ci95'][1])}] | {fmt(m['pr_auc'])} | "
            f"{fmt(m['accuracy'])} | {fmt(m['balanced_accuracy'])} | {fmt(m['precision'])} | "
            f"{fmt(m['sensitivity_recall'])} | {fmt(m['specificity'])} | {fmt(m['f1'])} | {fmt(m['mcc'])} | "
            f"{fmt(m['brier'], 4)} | {fmt(m['ece'], 4)} |")


TABLE_HEAD = ("| Model | AUC [95% CI] | PR-AUC | Accuracy | Balanced acc. | Precision | Recall | Specificity | F1 | MCC | Brier | ECE |\n"
              "|---|---|---|---|---|---|---|---|---|---|---|---|")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--final-prefix", default="final_", help="runs whose name starts with this form the final model")
    ap.add_argument("--out", default="", help="write to results/tracker_v2/<out>/ instead of the main folder")
    args = ap.parse_args()
    global RESULTS, FIGS
    if args.out:
        RESULTS = os.path.join(RESULTS, args.out)
        FIGS = os.path.join(RESULTS, "figures")
        os.makedirs(RESULTS, exist_ok=True)
    plt = ev._plt()
    os.makedirs(FIGS, exist_ok=True)
    runs = load_runs()
    finals = [r for n, r in runs.items() if n.startswith(args.final_prefix)]
    if not finals:
        sys.exit(f"no runs starting with {args.final_prefix!r} found")
    best = max(finals, key=lambda r: r["best_val_auc"])          # chosen on VALIDATION only
    extra_n = best["extra_n"]
    print(f"final model: {best['name']} (val AUC {best['best_val_auc']:.4f}, variant {best['variant']}, "
          f"train students {best['train_students']})")

    # ---------------- data ----------------
    orig = ft.load_sequences(f"{DATA}/generated_logs.csv", f"{DATA}/generated_logs_oracle.csv")
    tr, va, te = ft.original_split(len(orig["nodes"]))
    train, val, orig_test = ft.take(orig, tr), ft.take(orig, va), ft.take(orig, te)
    if extra_n:
        more = ft.load_sequences(f"{EXTRA}/train_extra.csv", f"{EXTRA}/train_extra_oracle.csv")
        train = ft.concat(train, ft.take(more, np.arange(extra_n)))
    fresh = ft.load_sequences(f"{EXTRA}/fresh_test.csv", f"{EXTRA}/fresh_test_oracle.csv")
    tests = {"orig_test": orig_test, "fresh_test": fresh}
    labels = {k: d["passed"].numpy() for k, d in tests.items()}
    y_val = val["passed"].numpy()

    # ---------------- model predictions (calibrated probabilities) ----------------
    ei = ft.get_edge_index()
    v1_ck = torch.load(V1_CHECKPOINT, weights_only=False)
    v1_model = DualGCNTracker(25, 64, 64)
    v1_model.load_state_dict(v1_ck["model_state_dict"])
    v1_off = math.log(V1_POS_WEIGHT)
    v1_logits = {"val": ft.predict_logits(v1_model, val, ei)}
    for k, d in tests.items():
        v1_logits[k] = ft.predict_logits(v1_model, d, ei)

    probs = {k: {} for k in ["val", *tests]}
    for split in probs:
        probs[split][V2] = ev.calibrated(best["logits"][split])
        probs[split][V1] = ev.calibrated(v1_logits[split], v1_off)

    # baselines see the same training data as the final model
    S = train["passed"].numpy(), train["seconds"].numpy()
    prior = PriorOnly().fit(S[0])
    logreg, gboost = HistoryModel("logreg").fit(*S), HistoryModel("gboost").fit(*S)
    datasets = {"val": val, **tests}
    for split, d in datasets.items():
        probs[split][gboost.name] = gboost.predict(d["passed"].numpy(), d["seconds"].numpy())
        probs[split][logreg.name] = logreg.predict(d["passed"].numpy(), d["seconds"].numpy())
        probs[split][prior.name] = prior.predict(d["passed"].numpy(), d["seconds"].numpy())
        probs[split]["Oracle ceiling"] = d["oracle"]

    # ---------------- metrics at validation-chosen thresholds ----------------
    thresholds = {name: ev.youden_threshold(y_val, probs["val"][name]) for name in probs["val"]}
    metrics = {k: {} for k in tests}
    for split in tests:
        for name, p in probs[split].items():
            metrics[split][name] = ev.summarize(labels[split], p, thresholds[name])
        # the original model exactly as it was first reported: raw sigmoid, threshold 0.5
        metrics[split]["v1 as originally reported (thr 0.5, uncalibrated)"] = ev.summarize(
            labels[split], 1 / (1 + np.exp(-v1_logits[split])), 0.5)

    # ---------------- seeds / ablation / noise ----------------
    def collect(prefix):
        return [r for n, r in runs.items() if n.startswith(prefix)]

    summary = {"final_run": best["name"], "variant": best["variant"], "train_students": best["train_students"],
               "thresholds": thresholds, "metrics": metrics}
    summary["final_seeds"] = {r["name"]: {"best_val_auc": r["best_val_auc"], **{k: v["auc"] for k, v in r["test"].items()}}
                              for r in finals}
    summary["ablation"] = [{"name": r["name"], "variant": r["variant"], "val_auc": r["best_val_auc"],
                            **{k: v["auc"] for k, v in r["test"].items()}} for r in collect("abl_")]
    noise = {}
    for r in collect("noise_"):
        lvl = r["data"]
        noise.setdefault(lvl, {})[r["variant"]] = {"auc": r["test"]["test"]["auc"], "oracle": r["test"]["test"]["oracle_auc"],
                                                   "val_auc": r["best_val_auc"]}
    summary["noise"] = noise
    with open(os.path.join(RESULTS, "metrics.json"), "w") as f:
        json.dump(summary, f, indent=2)

    # ---------------- figures ----------------
    main_split = "fresh_test"
    ysplit = labels[main_split]
    show = {V2: probs[main_split][V2], V1: probs[main_split][V1],
            gboost.name: probs[main_split][gboost.name], "Oracle ceiling": probs[main_split]["Oracle ceiling"]}

    fig, ax = plt.subplots(1, 2, figsize=(10, 4.4))
    ev.plot_confusion(ax[0], metrics[main_split][V1]["confusion"],
                      f"{V1}\nthreshold {thresholds[V1]:.2f} (chosen on validation)")
    ev.plot_confusion(ax[1], metrics[main_split][V2]["confusion"],
                      f"{V2}\nthreshold {thresholds[V2]:.2f} (chosen on validation)")
    fig.suptitle(f"Confusion matrices - {len(ysplit)} held-out students, {ysplit.size:,} predictions", fontsize=12)
    ev.save_fig(fig, os.path.join(FIGS, "confusion_matrix.png"))

    fig, ax = plt.subplots(figsize=(6, 5)); ev.plot_roc(ax, ysplit, show); ev.save_fig(fig, os.path.join(FIGS, "roc_curve.png"))
    fig, ax = plt.subplots(figsize=(6, 5)); ev.plot_pr(ax, ysplit, {V2: show[V2], V1: show[V1]}); ev.save_fig(fig, os.path.join(FIGS, "precision_recall.png"))
    step_curves = {n: metrics[main_split][n]["per_step_auc"] for n in [V2, V1, gboost.name, "Oracle ceiling"]}
    fig, ax = plt.subplots(figsize=(7, 4.6)); ev.plot_step_auc(ax, step_curves); ev.save_fig(fig, os.path.join(FIGS, "auc_by_step.png"))
    fig, ax = plt.subplots(figsize=(5.6, 5)); ev.plot_calibration(ax, ysplit, {V2: show[V2], V1: show[V1]}); ev.save_fig(fig, os.path.join(FIGS, "calibration.png"))

    abl = summary["ablation"]
    if abl:
        labels_map = {"original": "Original\narchitecture", "logtime": "+ log-time\nfeature",
                      "global_nograph": "Global state,\nGRAPH REMOVED",
                      "global": "+ global learner\nstate", "global_logtime": "+ global state\n+ log-time"}
        order = [v for v in labels_map if any(a["variant"] == v for a in abl)]
        fig, ax = plt.subplots(figsize=(8.5, 4.6))
        width = 0.36
        for j, (split, color) in enumerate((("orig_test", "#4c78a8"), ("fresh_test", "#f58518"))):
            vals = [np.mean([a[split] for a in abl if a["variant"] == v]) for v in order]
            bars = ax.bar(np.arange(len(order)) + (j - 0.5) * width, vals, width, color=color,
                          label="Original 250-student test" if split == "orig_test" else "Fresh 1000-student test")
            for b, v in zip(bars, vals):
                ax.text(b.get_x() + b.get_width() / 2, v + 0.002, f"{v:.3f}", ha="center", fontsize=8)
        ax.axhline(TARGET_AUC, color="green", ls="--", lw=1.2, label=f"Target {TARGET_AUC}")
        ax.axhline(metrics["fresh_test"]["Oracle ceiling"]["auc"], color="red", ls=":", lw=1.5,
                   label=f"Oracle ceiling ({metrics['fresh_test']['Oracle ceiling']['auc']:.3f})")
        ax.set_xticks(range(len(order)), [labels_map[v] for v in order]); ax.set_ylim(0.68, 0.82)
        ax.set_ylabel("Test AUC"); ax.set_title("Ablation: what each change contributes"); ax.legend(fontsize=8, loc="upper left")
        ax.grid(axis="y", alpha=0.3)
        ev.save_fig(fig, os.path.join(FIGS, "ablation.png"))

    levels = [(k, lab) for k, lab in (("noise_high", "High noise\n(slip, guess x1.5)"), ("noise_orig", "Original\nnoise"),
                                      ("noise_low", "Low noise\n(slip, guess x0.5)"))
              if k in noise and "original" in noise[k] and summary["variant"] in noise[k]]
    if levels:
        fig, ax = plt.subplots(figsize=(8, 4.8))
        x = np.arange(len(levels))
        series = [("Oracle ceiling", "oracle", "red", ":"), (V1, "original", "#4c78a8", "-"),
                  (V2, summary["variant"], "#f58518", "-")]
        for name, key, color, ls in series:
            ys = [noise[k].get("oracle") if key == "oracle" else noise[k].get(key, {}).get("auc") for k, _ in levels]
            if key == "oracle":
                ys = [next(iter(noise[k].values()))["oracle"] for k, _ in levels]
            ax.plot(x, ys, marker="o", color=color, ls=ls, lw=2.2, label=name)
            for xi, yi in zip(x, ys):
                if yi is not None:
                    ax.text(xi, yi + 0.004, f"{yi:.3f}", ha="center", fontsize=8, color=color)
        ax.axhline(TARGET_AUC, color="green", ls="--", lw=1, label=f"Target {TARGET_AUC}")
        ax.axhline(0.80, color="purple", ls="--", lw=1, label="Proposal target 0.80")
        ax.set_xticks(x, [lab for _, lab in levels]); ax.set_ylabel("Test AUC")
        ax.set_title("Data-noise sensitivity: model AUC follows the data's ceiling")
        ax.legend(fontsize=8); ax.grid(alpha=0.3)
        ev.save_fig(fig, os.path.join(FIGS, "noise_sensitivity.png"))

    # combined one-page dashboard
    fig, axes = plt.subplots(2, 3, figsize=(17, 9.5))
    ev.plot_roc(axes[0, 0], ysplit, show)
    ev.plot_confusion(axes[0, 1], metrics[main_split][V2]["confusion"], f"{V2} - confusion matrix\n(threshold {thresholds[V2]:.2f})")
    ev.plot_step_auc(axes[0, 2], step_curves)
    ev.plot_calibration(axes[1, 0], ysplit, {V2: show[V2], V1: show[V1]})
    ev.plot_pr(axes[1, 1], ysplit, {V2: show[V2], V1: show[V1]})
    axes[1, 2].axis("off")
    m2, m1, mo = metrics[main_split][V2], metrics[main_split][V1], metrics[main_split]["Oracle ceiling"]
    txt = (f"Held-out test: {len(ysplit)} unseen students\n\n"
           f"AUC          v2 {m2['auc']:.3f}   v1 {m1['auc']:.3f}   ceiling {mo['auc']:.3f}\n"
           f"95% CI (v2)  [{m2['auc_ci95'][0]:.3f}, {m2['auc_ci95'][1]:.3f}]\n"
           f"Share of ceiling reached: v2 {m2['auc'] / mo['auc']:.1%}   v1 {m1['auc'] / mo['auc']:.1%}\n\n"
           f"v2 at validation-chosen threshold\n"
           f"Accuracy {m2['accuracy']:.3f}   Balanced {m2['balanced_accuracy']:.3f}\n"
           f"Recall {m2['sensitivity_recall']:.3f}   Specificity {m2['specificity']:.3f}\n"
           f"Precision {m2['precision']:.3f}   F1 {m2['f1']:.3f}   MCC {m2['mcc']:.3f}\n"
           f"Brier {m2['brier']:.3f}   ECE {m2['ece']:.3f}")
    axes[1, 2].text(0.0, 0.95, txt, va="top", family="monospace", fontsize=10.5)
    fig.suptitle("Dual-GCN knowledge tracker - evaluation summary", fontsize=15)
    ev.save_fig(fig, os.path.join(FIGS, "dashboard.png"))

    # ---------------- markdown ----------------
    md = []
    md.append("# Knowledge tracker - evaluation report\n")
    md.append("Generated by `experiments/report_tracker_v2.py` from saved predictions; nothing is hand-entered.\n")
    md.append("## Protocol\n")
    md.append(f"- Task: before each of a student's 25 interactions, predict whether they will pass it, from the earlier history only (no look-ahead).\n"
              f"- Training students: {best['train_students']:,}. Validation: {len(val['nodes'])} students (used only to pick the epoch, the variant and the decision threshold).\n"
              f"- Two held-out test sets, never used for any choice: the **original 250-student test split** (same students as the previously reported 0.7176) and a **fresh 1,000-student set** (new random seed) for tighter confidence intervals.\n"
              f"- Probabilities are calibrated before computing Brier/ECE/threshold metrics (the original model's class-weight offset is removed). The operating threshold is chosen on validation by Youden's J and applied unchanged to test.\n"
              f"- 95% confidence intervals resample whole students (1,000 bootstrap draws).\n"
              f"- **Oracle ceiling** = AUC of the simulator's true pass probabilities, which uses hidden information no real tracker can observe; it is the theoretical maximum on this data. The proposal's 0.80 target lies above it.\n")
    for split, title in (("fresh_test", "Fresh 1,000-student test set"), ("orig_test", "Original 250-student test split")):
        md.append(f"## Results - {title}\n")
        md.append(TABLE_HEAD)
        order = ["Oracle ceiling", V2, V1, "v1 as originally reported (thr 0.5, uncalibrated)",
                 gboost.name, logreg.name, prior.name]
        for n in order:
            md.append(row(n, metrics[split][n]))
        md.append("")
        c = metrics[split][V2]["confusion"]
        md.append(f"{V2} confusion matrix (counts): TN {c['tn']:,} | FP {c['fp']:,} | FN {c['fn']:,} | TP {c['tp']:,}; "
                  f"cold-start AUC (steps 1-2) {fmt(metrics[split][V2]['cold_auc'])}, steady-state AUC (steps 3-25) {fmt(metrics[split][V2]['steady_auc'])} "
                  f"(oracle {fmt(metrics[split]['Oracle ceiling']['cold_auc'])} / {fmt(metrics[split]['Oracle ceiling']['steady_auc'])}).\n")
    md.append("## Consistency across training seeds (test AUC)\n")
    md.append("| Run | Validation AUC | Original test | Fresh test |\n|---|---|---|---|")
    for n, v in summary["final_seeds"].items():
        md.append(f"| {n} | {fmt(v['best_val_auc'], 4)} | {fmt(v['orig_test'], 4)} | {fmt(v['fresh_test'], 4)} |")
    if len(finals) > 1:
        a = np.array([[v["orig_test"], v["fresh_test"]] for v in summary["final_seeds"].values()])
        md.append(f"| **mean +/- std** | | {a[:,0].mean():.4f} +/- {a[:,0].std():.4f} | {a[:,1].mean():.4f} +/- {a[:,1].std():.4f} |")
    md.append("")
    if abl:
        md.append("## Ablation (same data, same budget, single seed per row)\n")
        md.append("| Variant | Validation AUC | Original test AUC | Fresh test AUC |\n|---|---|---|---|")
        for a in abl:
            md.append(f"| {a['variant']} | {fmt(a['val_auc'], 4)} | {fmt(a['orig_test'], 4)} | {fmt(a['fresh_test'], 4)} |")
        md.append("")
    if levels:
        md.append("## Data-noise sensitivity study\n")
        md.append("Same simulator, only the slip and guess rates are scaled (these set the ceiling). Each level has its own 3,000 students (2,000 train / 500 val / 500 test). "
                  "This is a sensitivity analysis on **different data**, reported separately from the headline results above.\n")
        md.append("| Noise level | Oracle ceiling | v1 architecture | v2 (this work) | v2 share of ceiling |\n|---|---|---|---|---|")
        for k, lab in levels:
            o = next(iter(noise[k].values()))["oracle"]
            a1 = noise[k].get("original", {}).get("auc")
            a2 = noise[k].get(summary["variant"], {}).get("auc")
            md.append(f"| {lab.replace(chr(10), ' ')} | {fmt(o)} | {fmt(a1) if a1 else 'n/a'} | {fmt(a2) if a2 else 'n/a'} | "
                      f"{(f'{a2 / o:.1%}' if a2 else 'n/a')} |")
        md.append("")
    md.append("## Figures\n")
    for f in ("dashboard", "confusion_matrix", "roc_curve", "precision_recall", "auc_by_step", "calibration", "ablation", "noise_sensitivity"):
        if os.path.exists(os.path.join(FIGS, f + ".png")):
            md.append(f"![{f}](figures/{f}.png)\n")
    with open(os.path.join(RESULTS, "RESULTS.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(md))
    print("wrote", os.path.join(RESULTS, "RESULTS.md"))


if __name__ == "__main__":
    main()
