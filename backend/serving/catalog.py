"""Read-only views of the static curriculum: the prerequisite graph, the curated resource
bank and per-concept relations. Everything here is derived from `knowledge_graph` and the
content bank in `content_engine` -- nothing is duplicated or invented for the UI."""
import networkx as nx

from knowledge_graph.graph_builder import CONCEPTS, CONCEPT_TO_ID, CONCEPT_BLOCKS, build_python_dag
from serving.content_engine import CONTENT_BANK

CONCEPT_TO_BLOCK = {c: i for i, b in enumerate(CONCEPT_BLOCKS) for c in b["concepts"]}


def block_of(concept):
    return CONCEPT_TO_BLOCK[concept]


def graph_payload():
    """Nodes (with layer depth = longest path from a root), directed prerequisite edges and the
    five curriculum blocks. `depth` lets a client lay the DAG out in layers."""
    g = build_python_dag()
    depth = {}
    for node in nx.topological_sort(g):
        preds = list(g.predecessors(node))
        depth[node] = 0 if not preds else 1 + max(depth[p] for p in preds)
    return {
        "nodes": [
            {"id": CONCEPT_TO_ID[c], "concept": c, "block_index": CONCEPT_TO_BLOCK[c], "depth": depth[c]}
            for c in CONCEPTS
        ],
        "edges": [{"source": CONCEPT_TO_ID[a], "target": CONCEPT_TO_ID[b]} for a, b in g.edges()],
        "blocks": [{"index": i, "name": b["name"], "concepts": b["concepts"]} for i, b in enumerate(CONCEPT_BLOCKS)],
    }


def relations():
    """{concept: {"prerequisites": [...direct], "dependents": [...direct], "ancestors": [...all]}}"""
    g = build_python_dag()
    return {
        c: {
            "prerequisites": [p for p in CONCEPTS if g.has_edge(p, c)],
            "dependents": [d for d in CONCEPTS if g.has_edge(c, d)],
            "ancestors": [a for a in CONCEPTS if a in nx.ancestors(g, c)],
        }
        for c in CONCEPTS
    }


def resource_items(seen_ids=frozenset()):
    """One entry per concept with its curated video and docs deep-dive. `seen_ids` is the set
    of content ids the student has already viewed inside a session. Several concepts share one
    URL; `shares_*_with` lists the other concepts on the same source."""
    by_video, by_doc = {}, {}
    for c in CONCEPTS:
        by_video.setdefault(CONTENT_BANK[c]["video"]["url"], []).append(c)
        by_doc.setdefault(CONTENT_BANK[c]["deep_dive"]["url"], []).append(c)
    items = []
    for c in CONCEPTS:
        v, d = CONTENT_BANK[c]["video"], CONTENT_BANK[c]["deep_dive"]
        items.append({
            "concept": c,
            "block_index": CONCEPT_TO_BLOCK[c],
            "video": {**v, "seen": v["id"] in seen_ids},
            "deep_dive": {**d, "seen": d["id"] in seen_ids},
            "shares_video_with": [o for o in by_video[v["url"]] if o != c],
            "shares_deep_dive_with": [o for o in by_doc[d["url"]] if o != c],
        })
    return items
