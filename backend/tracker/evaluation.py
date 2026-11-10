"""Evaluation metrics and figures for the knowledge tracker.

Conventions
- y and p are numpy arrays of shape [students, steps]; the positive class is
  "student passes". p must be a CALIBRATED probability: remove any class-weight
  offset (see calibrated()) before calling.
- Operating thresholds are chosen on the VALIDATION set only (Youden's J,
  i.e. balanced sensitivity/specificity, independent of class prevalence) and
  then applied unchanged to the test set -- the test set never influences them.
- Confidence intervals resample whole STUDENTS (not individual steps), since
  steps within one student are correlated.
"""
import numpy as np
from sklearn.metrics import (
    average_precision_score, brier_score_loss, confusion_matrix, log_loss,
    roc_auc_score, roc_curve,
)


def calibrated(logits, class_weight_offset=0.0):
    """Probabilities from raw logits. A model trained with BCE pos_weight=w
    reports odds multiplied by w; pass offset=ln(w) to undo that."""
    return 1.0 / (1.0 + np.exp(-(np.asarray(logits) - class_weight_offset)))


def expected_calibration_error(y, p, bins=10):
    y, p = np.asarray(y).ravel(), np.asarray(p).ravel()
    edges = np.linspace(0, 1, bins + 1)
    which = np.clip(np.digitize(p, edges[1:-1]), 0, bins - 1)
    ece = 0.0
    for b in range(bins):
        m = which == b
        if m.any():
            ece += m.mean() * abs(y[m].mean() - p[m].mean())
    return float(ece)


def youden_threshold(y, p):
    fpr, tpr, thr = roc_curve(np.asarray(y).ravel(), np.asarray(p).ravel())
    return float(thr[np.argmax(tpr - fpr)])


def bootstrap_auc_ci(y, p, n_boot=1000, seed=0):
    rng = np.random.RandomState(seed)
    S = y.shape[0]
    aucs = []
    for _ in range(n_boot):
        ii = rng.randint(0, S, S)
        aucs.append(roc_auc_score(y[ii].ravel(), p[ii].ravel()))
    return float(np.percentile(aucs, 2.5)), float(np.percentile(aucs, 97.5))


def per_step_auc(y, p):
    return [float(roc_auc_score(y[:, t], p[:, t])) for t in range(y.shape[1])]


def summarize(y, p, threshold, cold_steps=2, n_boot=1000):
    """Full metric set at a fixed operating threshold."""
    yf, pf = y.ravel(), p.ravel()
    pred = (pf >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(yf, pred).ravel()
    sens, spec = tp / (tp + fn), tn / (tn + fp)
    prec = tp / max(tp + fp, 1)
    npv = tn / max(tn + fn, 1)
    f1 = 2 * prec * sens / max(prec + sens, 1e-12)
    mcc_den = np.sqrt(float(tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))
    lo, hi = bootstrap_auc_ci(y, p, n_boot)
    return {
        "auc": float(roc_auc_score(yf, pf)), "auc_ci95": [lo, hi],
        "pr_auc": float(average_precision_score(yf, pf)),
        "brier": float(brier_score_loss(yf, pf)), "log_loss": float(log_loss(yf, pf)),
        "ece": expected_calibration_error(yf, pf),
        "threshold": float(threshold),
        "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "accuracy": float((tp + tn) / (tp + tn + fp + fn)),
        "balanced_accuracy": float((sens + spec) / 2),
        "sensitivity_recall": float(sens), "specificity": float(spec),
        "precision": float(prec), "npv": float(npv), "f1": float(f1),
        "mcc": float((tp * tn - fp * fn) / mcc_den) if mcc_den > 0 else 0.0,
        "pass_rate": float(yf.mean()),
        "cold_auc": float(roc_auc_score(y[:, :cold_steps].ravel(), p[:, :cold_steps].ravel())),
        "steady_auc": float(roc_auc_score(y[:, cold_steps:].ravel(), p[:, cold_steps:].ravel())),
        "per_step_auc": per_step_auc(y, p),
    }


# ----------------------------------------------------------------------
# Figures
# ----------------------------------------------------------------------
def _plt():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    return plt


def plot_confusion(ax, conf, title):
    c = np.array([[conf["tn"], conf["fp"]], [conf["fn"], conf["tp"]]])
    norm = c / c.sum(axis=1, keepdims=True)
    ax.imshow(norm, cmap="Blues", vmin=0, vmax=1)
    for i in range(2):
        for j in range(2):
            ax.text(j, i, f"{c[i, j]:,}\n({norm[i, j]:.1%})", ha="center", va="center",
                    color="white" if norm[i, j] > 0.5 else "black", fontsize=11)
    ax.set_xticks([0, 1], ["Predicted\nFail", "Predicted\nPass"])
    ax.set_yticks([0, 1], ["Actual\nFail", "Actual\nPass"])
    ax.set_title(title, fontsize=11)


def plot_roc(ax, y, scored, colors=None):
    """scored: {name: probabilities [S,T]}; draws ROC curves with AUC in the legend."""
    for name, p in scored.items():
        fpr, tpr, _ = roc_curve(y.ravel(), p.ravel())
        ax.plot(fpr, tpr, label=f"{name} (AUC {roc_auc_score(y.ravel(), p.ravel()):.3f})",
                lw=2.2 if "v2" in name or "Oracle" in name else 1.5,
                ls="--" if "Oracle" in name else "-")
    ax.plot([0, 1], [0, 1], color="grey", lw=1, ls=":")
    ax.set_xlabel("False positive rate"); ax.set_ylabel("True positive rate")
    ax.set_title("ROC curve (held-out students)"); ax.legend(loc="lower right", fontsize=8)
    ax.grid(alpha=0.3)


def plot_pr(ax, y, scored):
    for name, p in scored.items():
        prec_rec = average_precision_score(y.ravel(), p.ravel())
        from sklearn.metrics import precision_recall_curve
        pr, rc, _ = precision_recall_curve(y.ravel(), p.ravel())
        ax.plot(rc, pr, label=f"{name} (AP {prec_rec:.3f})", lw=2.2 if "v2" in name else 1.5)
    ax.axhline(y.mean(), color="grey", ls=":", lw=1, label=f"Chance ({y.mean():.2f})")
    ax.set_xlabel("Recall (pass)"); ax.set_ylabel("Precision (pass)")
    ax.set_title("Precision-recall curve"); ax.legend(fontsize=8); ax.grid(alpha=0.3)


def plot_step_auc(ax, step_aucs):
    """step_aucs: {name: list of 25 per-step AUCs}."""
    for name, vals in step_aucs.items():
        ax.plot(range(1, len(vals) + 1), vals, marker="o", ms=3,
                lw=2.2 if "v2" in name else 1.5, ls="--" if "Oracle" in name else "-", label=name)
    ax.set_xlabel("Interaction number in the student's history")
    ax.set_ylabel("AUC at that step"); ax.set_ylim(0.45, 0.9)
    ax.set_title("AUC by step: accuracy grows with history\n(step 1 has no history to learn from)")
    ax.legend(fontsize=8); ax.grid(alpha=0.3)


def plot_calibration(ax, y, scored, bins=10):
    edges = np.linspace(0, 1, bins + 1)
    for name, p in scored.items():
        yf, pf = y.ravel(), p.ravel()
        which = np.clip(np.digitize(pf, edges[1:-1]), 0, bins - 1)
        xs, ys = [], []
        for b in range(bins):
            m = which == b
            if m.sum() >= 30:
                xs.append(pf[m].mean()); ys.append(yf[m].mean())
        ax.plot(xs, ys, marker="o", lw=2.2 if "v2" in name else 1.5,
                label=f"{name} (ECE {expected_calibration_error(yf, pf):.3f})")
    ax.plot([0, 1], [0, 1], color="grey", ls=":", lw=1, label="Perfect calibration")
    ax.set_xlabel("Predicted pass probability"); ax.set_ylabel("Observed pass rate")
    ax.set_title("Calibration (reliability diagram)"); ax.legend(fontsize=8); ax.grid(alpha=0.3)


def save_fig(fig, path):
    fig.tight_layout()
    fig.savefig(path, dpi=160, bbox_inches="tight")
    _plt().close(fig)
