import networkx as nx
import matplotlib.pyplot as plt
import os
import sys

# Tell Python to look in the 'backend' folder
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from knowledge_graph.graph_builder import python_kg

plt.figure(figsize=(18, 12))

# --- BULLETPROOF LAYOUT (No Graphviz needed) ---
# 1. Calculate the 'depth' of each node to create left-to-right columns
for layer, nodes in enumerate(nx.topological_generations(python_kg)):
    for node in nodes:
        python_kg.nodes[node]["layer"] = layer

# 2. Use the built-in multipartite layout to draw it horizontally
pos = nx.multipartite_layout(python_kg, subset_key="layer", align="horizontal")

nx.draw(python_kg, pos, 
        with_labels=True, 
        node_color='lightblue', 
        node_size=3500, 
        font_size=10, 
        font_weight='bold', 
        edge_color='gray', 
        arrows=True,
        arrowsize=20)

plt.title("NeuroTutor Knowledge Graph (DAG)", size=20)
plt.savefig("dag_visual.png", format="PNG", dpi=300)
print("Saved dag_visual.png successfully!")