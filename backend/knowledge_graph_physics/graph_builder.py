import networkx as nx

# Explicit, deterministic mapping between string concepts and integer IDs (0 to 24).
# Scope: primary-school-level physics (roughly ages 6-11) -- states of matter,
# forces and simple machines, light, and sound/earth-motion. Mirrors the
# structure of knowledge_graph/graph_builder.py (the Python curriculum graph)
# so the same DAG-based tooling (topological sort, ancestor lookup, DualGCN-
# style belief propagation) can be reused against a different subject.
CONCEPTS = [
    # Block 1: Matter & Materials
    "States of Matter", "Properties of Materials", "Floating and Sinking",
    "Melting and Freezing", "Evaporation and Condensation",
    # Block 2: Forces & Motion
    "Push and Pull", "Force", "Friction", "Gravity", "Magnetism",
    # Block 3: Simple Machines & Energy
    "What Is Energy", "Levers", "Wheels and Axles", "Ramps and Inclined Planes", "Energy Sources",
    # Block 4: Light
    "Light Sources", "Transparent Translucent Opaque", "Shadows", "Reflection", "How We See",
    # Block 5: Sound, Earth & Space
    "Vibration", "Sound Sources", "Loud and Quiet", "Day and Night", "Seasons",
]

CONCEPT_TO_ID = {name: idx for idx, name in enumerate(CONCEPTS)}
ID_TO_CONCEPT = {idx: name for idx, name in enumerate(CONCEPTS)}

# The 5 curriculum blocks above were always implicit in CONCEPTS' grouping
# (see the comments), just never exposed as real data -- same convention as
# knowledge_graph/graph_builder.py's CONCEPT_BLOCKS.
CONCEPT_BLOCKS = [
    {"name": "Matter & Materials", "concepts": CONCEPTS[0:5]},
    {"name": "Forces & Motion", "concepts": CONCEPTS[5:10]},
    {"name": "Simple Machines & Energy", "concepts": CONCEPTS[10:15]},
    {"name": "Light", "concepts": CONCEPTS[15:20]},
    {"name": "Sound, Earth & Space", "concepts": CONCEPTS[20:25]},
]


def build_physics_dag():
    """
    Constructs the Directed Acyclic Graph (DAG) for the primary-school
    physics curriculum. Nodes are assigned deterministic integer IDs to
    ensure tensor alignment if this graph is ever fed into the same
    GNN-based tracker used for the Python curriculum.
    Edges represent prerequisite dependencies (Source -> Target), and are
    ordered so a prerequisite's ID is always lower than its dependent's --
    i.e. CONCEPTS' own order is already a valid topological sort.
    """
    G = nx.DiGraph()

    # Add nodes with integer IDs and concept name attributes
    for idx, name in enumerate(CONCEPTS):
        G.add_node(name, id=idx)

    # Define prerequisite relationships (Prerequisite -> Dependent Concept)
    edges = [
        # Block 1: Matter & Materials (Roots)
        ("States of Matter", "Melting and Freezing"),
        ("States of Matter", "Evaporation and Condensation"),
        ("Properties of Materials", "Floating and Sinking"),

        # Block 2: Forces & Motion
        ("Push and Pull", "Force"),
        ("Force", "Friction"),
        ("Force", "Gravity"),
        ("Force", "Magnetism"),

        # Block 3: Simple Machines & Energy
        ("Force", "What Is Energy"),
        ("What Is Energy", "Levers"),
        ("Push and Pull", "Levers"),
        ("Levers", "Wheels and Axles"),
        ("Levers", "Ramps and Inclined Planes"),
        ("Friction", "Ramps and Inclined Planes"),
        ("What Is Energy", "Energy Sources"),

        # Block 4: Light
        ("Light Sources", "Shadows"),
        ("Light Sources", "How We See"),
        ("Light Sources", "Reflection"),
        ("Reflection", "How We See"),
        ("Properties of Materials", "Transparent Translucent Opaque"),
        ("Transparent Translucent Opaque", "Shadows"),

        # Block 5: Sound, Earth & Space
        ("Force", "Vibration"),
        ("Vibration", "Sound Sources"),
        ("Sound Sources", "Loud and Quiet"),
        ("Light Sources", "Day and Night"),
        ("Day and Night", "Seasons"),
    ]

    G.add_edges_from(edges)
    return G


# Backwards compatibility alias (matches knowledge_graph/graph_builder.py's
# own alias naming convention).
build_physics_knowledge_graph = build_physics_dag

# Module-level instance so `from knowledge_graph_physics.graph_builder import
# physics_kg` resolves on import, mirroring `python_kg` in the original module.
physics_kg = build_physics_dag()


def analyze_failure_dependencies(graph, failed_node):
    """Finds all prerequisite concepts that might have caused a failure."""
    ancestors = nx.ancestors(graph, failed_node)
    return ancestors


# Prevent sanity checks and prints from running on import
if __name__ == "__main__":
    # 1. Check DAG validity
    is_dag = nx.is_directed_acyclic_graph(physics_kg)
    print(f"Is valid DAG? {is_dag}")
    print(f"Total Concepts: {physics_kg.number_of_nodes()}")
    print(f"Total Edges: {physics_kg.number_of_edges()}")

    # 2. Extract Topological Sort
    if is_dag:
        safe_learning_path = list(nx.topological_sort(physics_kg))
        print("\nBaseline Linear Learning Path (Topological Sort):")
        for i, node in enumerate(safe_learning_path, 1):
            print(f"{i}. {node} (ID: {CONCEPT_TO_ID[node]})")

    # 3. Analyze failure nodes
    shadows_ancestors = analyze_failure_dependencies(physics_kg, "Shadows")
    seasons_ancestors = analyze_failure_dependencies(physics_kg, "Seasons")
    print(f"\nIf a student fails 'Shadows', check these prerequisites: {shadows_ancestors}")
    print(f"If a student fails 'Seasons', check these prerequisites: {seasons_ancestors}")
