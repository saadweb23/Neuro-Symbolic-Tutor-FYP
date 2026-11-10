import networkx as nx
import matplotlib.pyplot as plt
import os
import sys

# Tell Python to look in the 'backend' folder
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from knowledge_graph_physics.graph_builder import physics_kg

plt.figure(figsize=(18, 12))

# --- BULLETPROOF LAYOUT (No Graphviz needed) ---
# 1. Calculate the 'depth' of each node to create left-to-right columns
for layer, nodes in enumerate(nx.topological_generations(physics_kg)):
    for node in nodes:
        physics_kg.nodes[node]["layer"] = layer

# 2. Use the built-in multipartite layout to draw it horizontally
pos = nx.multipartite_layout(physics_kg, subset_key="layer", align="horizontal")

nx.draw(physics_kg, pos,
        with_labels=True,
        node_color='lightgreen',
        node_size=3500,
        font_size=9,
        font_weight='bold',
        edge_color='gray',
        arrows=True,
        arrowsize=20)

plt.title("Primary-School Physics Knowledge Graph (DAG)", size=20)
plt.savefig("physics_dag_visual.png", format="PNG", dpi=300)
print("Saved physics_dag_visual.png successfully!")
