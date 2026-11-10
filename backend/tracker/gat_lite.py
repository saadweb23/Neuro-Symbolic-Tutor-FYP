"""Pure-PyTorch GATConv for SERVING ONLY.

`torch_geometric` imports ~2,000 modules and costs ~190 MB of RAM, which a 512 MB free web service
cannot spare. The Dual-GCN tracker only needs one layer type: GATConv(in, out, heads, bias=False,
add_self_loops=True, dropout=p) with concatenated heads. This module reimplements exactly that
forward pass with the SAME parameter names (`lin.weight`, `att_src`, `att_dst`), so the trained
checkpoints load unchanged. It is selected by NEURO_LITE=1 (see tracker/dual_gcn.py); training and
research keep using torch_geometric. tests/test_lite_equivalence.py proves the outputs match.

Math (identical to torch_geometric.nn.GATConv, flow source -> target):
    x'      = lin(x)                       reshaped [N, heads, C]
    e_ji    = LeakyReLU(<x'_j, att_src> + <x'_i, att_dst>)     for every edge j -> i (plus self loops)
    alpha_ji= softmax over the incoming edges of i of e_ji     (stabilised by the per-node max, +1e-16)
    out_i   = concat_heads( sum_j alpha_ji * x'_j )
"""
import torch
import torch.nn as nn
import torch.nn.functional as F


class GATConv(nn.Module):
    def __init__(self, in_channels, out_channels, heads=1, concat=True, negative_slope=0.2,
                 dropout=0.0, add_self_loops=True, bias=True):
        super().__init__()
        if not concat or bias:
            raise NotImplementedError("GATConv (lite) supports exactly the configuration the tracker uses: "
                                      "concat=True, bias=False")
        self.in_channels, self.out_channels, self.heads = in_channels, out_channels, heads
        self.negative_slope, self.dropout, self.add_self_loops = negative_slope, dropout, add_self_loops
        self.lin = nn.Linear(in_channels, heads * out_channels, bias=False)
        self.att_src = nn.Parameter(torch.empty(1, heads, out_channels))
        self.att_dst = nn.Parameter(torch.empty(1, heads, out_channels))
        nn.init.xavier_uniform_(self.lin.weight)
        nn.init.xavier_uniform_(self.att_src)
        nn.init.xavier_uniform_(self.att_dst)

    def forward(self, x, edge_index):
        n, h, c = x.size(0), self.heads, self.out_channels
        src, dst = edge_index[0], edge_index[1]
        if self.add_self_loops:
            keep = src != dst                       # drop any existing self loops, then add exactly one per node
            loops = torch.arange(n, device=x.device)
            src = torch.cat([src[keep], loops])
            dst = torch.cat([dst[keep], loops])

        xp = self.lin(x).view(n, h, c)
        a_src = (xp * self.att_src).sum(-1)         # [N, heads]
        a_dst = (xp * self.att_dst).sum(-1)
        alpha = F.leaky_relu(a_src[src] + a_dst[dst], self.negative_slope)   # [E, heads]

        # softmax over the incoming edges of every target node
        index = dst.unsqueeze(-1).expand(-1, h)
        amax = torch.full((n, h), float("-inf"), dtype=alpha.dtype, device=alpha.device)
        amax = amax.scatter_reduce(0, index, alpha, reduce="amax", include_self=True)
        e = (alpha - amax[dst]).exp()
        denom = torch.zeros((n, h), dtype=e.dtype, device=e.device).index_add_(0, dst, e) + 1e-16
        alpha = F.dropout(e / denom[dst], p=self.dropout, training=self.training)

        out = torch.zeros((n, h, c), dtype=xp.dtype, device=xp.device)
        out.index_add_(0, dst, xp[src] * alpha.unsqueeze(-1))
        return out.view(n, h * c)
