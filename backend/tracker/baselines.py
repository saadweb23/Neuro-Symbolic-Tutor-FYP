"""Reference predictors that use only what a real tutor could observe
(past outcomes and response times), with no graph structure. They answer
"how much of the achievable signal does the graph model actually capture?"
and give the evaluation honest points of comparison.
"""
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler


def history_features(passed, seconds):
    """Features for predicting step t from steps < t only. passed/seconds:
    numpy [students, steps]. Returns X of shape [students*steps, F] in
    student-major order (matches y.ravel())."""
    S, T = passed.shape
    per_step = []
    for t in range(T):
        hist_o = np.full((S, T), -1.0)
        hist_t = np.full((S, T), -1.0)
        hist_o[:, :t] = passed[:, :t]
        hist_t[:, :t] = seconds[:, :t] / 180.0
        if t > 0:
            o, tm = passed[:, :t], seconds[:, :t]
            pass_time = np.where(o.sum(1) > 0, (tm * o).sum(1) / np.maximum(o.sum(1), 1), -1.0)
            fail_time = np.where((1 - o).sum(1) > 0, (tm * (1 - o)).sum(1) / np.maximum((1 - o).sum(1), 1), -1.0)
            agg = [o.mean(1), tm.mean(1), np.log(tm).mean(1), pass_time, fail_time,
                   o[:, -3:].mean(1), o[:, -1], tm[:, -1]]
        else:
            agg = [np.full(S, -1.0)] * 8
        per_step.append(np.column_stack([np.full(S, t), hist_o, hist_t] + agg))
    return np.stack(per_step, axis=1).reshape(S * T, -1)


class PriorOnly:
    """Per-concept (= per-step) pass rate from the training data; no student information."""
    name = "Concept prior only"

    def fit(self, passed_train):
        self.rate = passed_train.mean(0)
        return self

    def predict(self, passed, seconds):
        return np.tile(self.rate, (passed.shape[0], 1))


class HistoryModel:
    def __init__(self, kind):
        self.kind = kind
        self.name = {"logreg": "Logistic regression (history)", "gboost": "Gradient boosting (history)"}[kind]

    def fit(self, passed, seconds):
        X, y = history_features(passed, seconds), passed.ravel()
        if self.kind == "gboost":
            self.model = HistGradientBoostingClassifier(
                max_iter=300, learning_rate=0.05, max_leaf_nodes=15, l2_regularization=1.0,
                early_stopping=True, validation_fraction=0.15, random_state=0).fit(X, y)
        else:
            self.scaler = StandardScaler().fit(X)
            self.model = LogisticRegression(max_iter=3000, C=0.3).fit(self.scaler.transform(X), y)
        return self

    def predict(self, passed, seconds):
        X = history_features(passed, seconds)
        if self.kind == "logreg":
            X = self.scaler.transform(X)
        return self.model.predict_proba(X)[:, 1].reshape(passed.shape)
