import math
import os

import torch
import torch.nn as nn

if os.environ.get("NEURO_LITE") == "1":
    # Serving on a small free host: the same GATConv math in pure PyTorch (tracker/gat_lite.py),
    # so torch_geometric (~190 MB) is not imported. Research and training leave this unset.
    from tracker.gat_lite import GATConv
else:
    from torch_geometric.nn import GATConv


class SparsePathwayGNN(nn.Module):
    """Two-hop attention pathway with residual connections.

    Operates on a per-step signal that is nonzero only at the touched
    concept and propagates it outward across the curriculum graph.
    Both GAT layers run with bias=False so that a node which receives
    zero incoming messages produces an exact zero output instead of a
    leaked bias term. That property is what lets DualGCNTracker gate
    its GRU update on exact k-hop graph reachability rather than on
    output magnitude.
    """

    def __init__(self, feature_dim, hidden_dim, heads=4, dropout=0.1):
        super().__init__()
        assert hidden_dim % heads == 0, "hidden_dim must be divisible by heads"
        per_head = hidden_dim // heads

        self.gat1 = GATConv(feature_dim, per_head, heads=heads, bias=False,
                             add_self_loops=True, dropout=dropout)
        self.gat2 = GATConv(hidden_dim, per_head, heads=heads, bias=False,
                             add_self_loops=True, dropout=dropout)

        self.input_proj = (
            nn.Linear(feature_dim, hidden_dim, bias=False)
            if feature_dim != hidden_dim else nn.Identity()
        )
        self.norm1 = nn.LayerNorm(hidden_dim)
        self.norm2 = nn.LayerNorm(hidden_dim)
        self.drop = nn.Dropout(dropout)

    def forward(self, x, edge_index):
        # Hop 1: touched concept -> direct neighbors
        h1 = self.gat1(x, edge_index)
        h1 = self.norm1(h1 + self.input_proj(x))
        h1 = torch.relu(h1)

        # Hop 2: neighbors -> their neighbors, residual from hop 1
        h2 = self.gat2(h1, edge_index)
        h2 = self.norm2(h2 + h1)
        h2 = torch.relu(h2)

        return self.drop(h2)


class ConceptQueryHead(nn.Module):
    """Concept-conditioned MLP query head.

    The concept embedding gates the retrieved memory (FiLM-style) before
    the two are concatenated and scored, so the same memory row is read
    differently depending on which concept is being queried. `extra_dim`
    > 0 appends an additional context vector (the global learner state)
    to the scored input; at 0 the layer shapes are identical to the
    original head, so original checkpoints still load.
    """

    def __init__(self, hidden_dim, feature_dim, dropout=0.2, extra_dim=0):
        super().__init__()
        self.gate = nn.Sequential(
            nn.Linear(feature_dim, hidden_dim),
            nn.Sigmoid()
        )
        self.mlp = nn.Sequential(
            nn.Linear(hidden_dim + feature_dim + extra_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1)
        )

    def forward(self, node_memory, concept_feat, extra=None):
        gated_memory = node_memory * self.gate(concept_feat)
        parts = [gated_memory, concept_feat]
        if extra is not None:
            parts.append(extra)
        return self.mlp(torch.cat(parts, dim=-1)).squeeze(-1)


class DualGCNTracker(nn.Module):
    """Graph-based knowledge tracker.

    State layout: a tensor of shape [state_rows, hidden_dim]. Rows
    0..num_nodes-1 are per-concept memories, updated only for concepts
    within NUM_HOPS of the answered one (exact reachability gate). When
    `use_global_state` is on, one extra final row holds a learner-level
    state that is updated on EVERY interaction and read by the prediction
    head -- it carries whole-student signals (overall ability, speed,
    slip/guess tendency) that the local 2-hop memories cannot, since a
    student's general level applies to concepts far from the one just
    answered. Always allocate state with `init_state()`.

    `use_log_time` adds a log-scaled latency feature alongside the linear
    one, since response times are roughly log-normal (a 16s guess and a
    68s slip-up differ in ratio, not in absolute seconds).

    Both flags default to False, which reproduces the original model
    exactly (same parameters, same outputs).
    """

    # Must match the depth of SparsePathwayGNN (2 stacked GAT layers).
    NUM_HOPS = 2
    MAX_SECONDS = 180.0

    def __init__(self, num_nodes=25, feature_dim=64, hidden_dim=64,
                 heads=4, dropout=0.1, use_global_state=False, use_log_time=False,
                 belief_logit_offset=0.0, belief_logit_scale=1.0):
        super().__init__()
        self.num_nodes = num_nodes
        self.feature_dim = feature_dim
        self.hidden_dim = hidden_dim
        self.heads = heads
        self.dropout_p = dropout
        self.use_global_state = use_global_state
        self.use_log_time = use_log_time
        # Served logit = scale * raw_logit + offset (never applied during
        # training/evaluation). Lets a model trained on calibrated
        # probabilities report beliefs on the same scale the app's thresholds
        # and the PPO agent were built against (the original model was
        # trained with a class-balancing pos_weight and is less sharp). An
        # increasing transform, so it cannot change AUC or any ranking.
        self.belief_logit_offset = float(belief_logit_offset)
        self.belief_logit_scale = float(belief_logit_scale)

        # Concept base embeddings
        self.concept_embedding = nn.Embedding(num_nodes, feature_dim)

        # Time projection
        self.time_encoder = nn.Sequential(
            nn.Linear(2 if use_log_time else 1, feature_dim),
            nn.Tanh()
        )

        # Isolated positive / negative message-passing pathways.
        self.pathway_pos = SparsePathwayGNN(feature_dim, hidden_dim, heads, dropout)
        self.pathway_neg = SparsePathwayGNN(feature_dim, hidden_dim, heads, dropout)

        # Fusion layer with an identity residual back to the raw concept embedding
        self.identity_proj = nn.Linear(feature_dim, hidden_dim, bias=False)
        self.fusion = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.ReLU(),
        )
        self.fusion_norm = nn.LayerNorm(hidden_dim)

        # Recurrent state tracker
        self.gru = nn.GRUCell(hidden_dim, hidden_dim)

        # Learner-level (global) state channel
        if use_global_state:
            self.global_in = nn.Sequential(
                nn.Linear(2 * feature_dim + 2, hidden_dim),
                nn.ReLU(),
            )
            self.global_gru = nn.GRUCell(hidden_dim, hidden_dim)

        # Concept-conditioned mastery prediction head
        self.query_head = ConceptQueryHead(
            hidden_dim, feature_dim, dropout=0.2,
            extra_dim=hidden_dim if use_global_state else 0,
        )

        # Graph-structure cache (bidirectional edges + k-hop reachability mask).
        # Built lazily on the first forward() call so it lands on whatever
        # device the model has already been moved to, and rebuilt
        # automatically if a different edge_index or device is ever passed.
        self._cached_raw_edge_index = None
        self._batched_edge_cache = {}
        self.register_buffer(
            '_bidir_edge_index', torch.zeros(2, 0, dtype=torch.long), persistent=False
        )
        self.register_buffer(
            '_khop_mask', torch.zeros(num_nodes, num_nodes, dtype=torch.bool), persistent=False
        )

    # ------------------------------------------------------------------
    # Config / state helpers
    # ------------------------------------------------------------------
    @property
    def state_rows(self):
        return self.num_nodes + (1 if self.use_global_state else 0)

    def config(self):
        return {
            'num_nodes': self.num_nodes, 'feature_dim': self.feature_dim,
            'hidden_dim': self.hidden_dim, 'heads': self.heads, 'dropout': self.dropout_p,
            'use_global_state': self.use_global_state, 'use_log_time': self.use_log_time,
            'belief_logit_offset': self.belief_logit_offset,
            'belief_logit_scale': self.belief_logit_scale,
        }

    @classmethod
    def from_config(cls, cfg):
        return cls(**cfg)

    def init_state(self, batch_size=None, device=None):
        device = device if device is not None else self._khop_mask.device
        shape = (self.state_rows, self.hidden_dim)
        if batch_size is not None:
            shape = (batch_size,) + shape
        return torch.zeros(*shape, device=device)

    # ------------------------------------------------------------------
    # Graph cache
    # ------------------------------------------------------------------
    def _graph_cache_valid(self, edge_index):
        cached = self._cached_raw_edge_index
        if cached is None:
            return False
        if cached.device != edge_index.device or cached.shape != edge_index.shape:
            return False
        return torch.equal(cached, edge_index)

    def _build_graph_cache(self, edge_index):
        device = edge_index.device
        n = self.num_nodes

        adj = torch.zeros(n, n, dtype=torch.bool, device=device)
        if edge_index.numel() > 0:
            adj[edge_index[0], edge_index[1]] = True
        adj_sym = adj | adj.t()
        adj_self = adj_sym | torch.eye(n, dtype=torch.bool, device=device)

        # adj_self is symmetric, and the product of a symmetric matrix with
        # itself is symmetric too, so `reach` stays symmetric through every
        # iteration below - a row lookup and a column lookup agree.
        reach = adj_self.clone()
        for _ in range(self.NUM_HOPS - 1):
            reach = (reach.float() @ adj_self.float()) > 0

        bidir_edge_index = adj_sym.nonzero(as_tuple=False).t().contiguous()

        self._bidir_edge_index = bidir_edge_index
        self._khop_mask = reach
        self._cached_raw_edge_index = edge_index.detach().clone()
        self._batched_edge_cache = {}

    def _batched_edges(self, batch_size):
        """Bidirectional edges for `batch_size` disjoint copies of the graph
        (node ids offset by i * num_nodes), so one GAT call handles a whole
        batch of students."""
        key = (batch_size, self._bidir_edge_index.device)
        if key not in self._batched_edge_cache:
            offsets = (torch.arange(batch_size, device=self._bidir_edge_index.device)
                       * self.num_nodes).view(batch_size, 1, 1)
            ei = self._bidir_edge_index.unsqueeze(0) + offsets          # [B, 2, E]
            self._batched_edge_cache[key] = ei.permute(1, 0, 2).reshape(2, -1).contiguous()
        return self._batched_edge_cache[key]

    # ------------------------------------------------------------------
    # Batched core (training + evaluation)
    # ------------------------------------------------------------------
    def _time_feat(self, norm_time):
        t = norm_time.view(-1, 1)
        if self.use_log_time:
            raw = t * self.MAX_SECONDS
            t = torch.cat([t, torch.log1p(raw) / math.log1p(self.MAX_SECONDS)], dim=-1)
        return self.time_encoder(t)                                      # [B, F]

    def predict_batch(self, h_t, nodes, apply_offset=True):
        """Mastery logits for `nodes` ([B] concept ids) from states `h_t`
        ([B, state_rows, hidden]). Training/evaluation pass
        apply_offset=False to work with the raw calibrated logits."""
        batch = torch.arange(h_t.shape[0], device=h_t.device)
        concept_feat = self.concept_embedding(nodes)
        node_memory = h_t[batch, nodes]
        extra = h_t[:, self.num_nodes] if self.use_global_state else None
        logits = self.query_head(node_memory, concept_feat, extra)
        if apply_offset:
            logits = logits * self.belief_logit_scale + self.belief_logit_offset
        return logits

    def forward_batch(self, edge_index, target_nodes, passed, norm_time, h_t):
        """Advance B students' states by one observed interaction each.
        target_nodes: [B] long; passed: [B] (0/1); norm_time: [B] in [0,1];
        h_t: [B, state_rows, hidden]. Returns the next state, same shape."""
        if not self._graph_cache_valid(edge_index):
            self._build_graph_cache(edge_index)

        B, N, H = h_t.shape[0], self.num_nodes, self.hidden_dim
        batch = torch.arange(B, device=h_t.device)
        passed = passed.to(h_t.dtype)
        node_h = h_t[:, :N]

        device, dtype = h_t.device, h_t.dtype

        # 1. Enrich the touched concept's representation with latency
        time_feat = self._time_feat(norm_time)                           # [B, F]
        base_x = self.concept_embedding.weight                           # [N, F]
        signal_rows = base_x[target_nodes] + time_feat                   # [B, F]

        # 2-3. Two-hop propagation across prerequisite/dependent edges (edges
        #    are bidirectional so a failure also informs prerequisite
        #    mastery). Each sample feeds exactly one pathway (positive if it
        #    passed, else negative). The other pathway sees an all-zero input
        #    whose output is a sample-independent constant (non-zero once the
        #    LayerNorm biases are trained), so that constant is computed once
        #    per call instead of once per sample. Mathematically identical to
        #    running both pathways on every sample, at about half the cost.
        zero_in = torch.zeros(N, self.feature_dim, device=device, dtype=dtype)
        pos_prop = self.pathway_pos(zero_in, self._bidir_edge_index).unsqueeze(0).repeat(B, 1, 1)
        neg_prop = self.pathway_neg(zero_in, self._bidir_edge_index).unsqueeze(0).repeat(B, 1, 1)
        is_pos = passed > 0.5
        for pathway, sel, out in ((self.pathway_pos, is_pos, pos_prop),
                                  (self.pathway_neg, ~is_pos, neg_prop)):
            ids = sel.nonzero(as_tuple=True)[0]
            if ids.numel() == 0:
                continue
            signal = torch.zeros(ids.numel(), N, self.feature_dim, device=device, dtype=dtype)
            signal[torch.arange(ids.numel(), device=device), target_nodes[ids]] = signal_rows[ids]
            out[ids] = pathway(signal.reshape(-1, self.feature_dim),
                               self._batched_edges(ids.numel())).view(-1, N, H)

        # 4-5. Fuse the streams and apply the GRU update, only for concepts
        #    within NUM_HOPS of the answered one (exact reachability gate; the
        #    rest keep their memory unchanged, so computing them would be wasted).
        active = self._khop_mask[target_nodes]                           # [B, N] bool
        bi, ni = active.nonzero(as_tuple=True)
        fused = self.fusion(torch.cat([pos_prop[bi, ni], neg_prop[bi, ni]], dim=-1))
        fused = self.fusion_norm(fused + self.identity_proj(base_x)[ni])
        updated = self.gru(fused, node_h[bi, ni])
        node_next = node_h.clone()
        node_next[bi, ni] = updated

        if not self.use_global_state:
            return node_next

        # 6. Learner-level state: updated on every interaction, no gate
        g = h_t[:, N]
        outcome = torch.stack([passed, 1.0 - passed], dim=-1)
        g_in = self.global_in(torch.cat([base_x[target_nodes], time_feat, outcome], dim=-1))
        g_next = self.global_gru(g_in, g)
        return torch.cat([node_next, g_next.unsqueeze(1)], dim=1)

    # ------------------------------------------------------------------
    # Single-student interface (serving + RL environment)
    # ------------------------------------------------------------------
    def predict_node(self, h_t, node_id):
        """Predict mastery by querying memory alongside the target concept embedding."""
        nodes = torch.tensor([node_id], device=h_t.device)
        return self.predict_batch(h_t.unsqueeze(0), nodes)[0]

    def forward(self, edge_index, target_node, passed, norm_time, h_t):
        device = h_t.device
        out = self.forward_batch(
            edge_index,
            torch.tensor([target_node], device=device),
            torch.tensor([float(passed)], device=device),
            torch.tensor([float(norm_time)], device=device),
            h_t.unsqueeze(0),
        )
        return out[0]
