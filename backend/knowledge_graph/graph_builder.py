import networkx as nx

# Explicit, deterministic mapping between string concepts and integer IDs (0 to 24)
CONCEPTS = [
    # Block 1: Fundamentals
    "Syntax", "Primitive Data Types", "Variables", "Arithmetic Operators", "Relational Operators",
    # Block 2: Control Flow
    "Conditionals", "While Loops", "For Loops", "Loop Control", "Nested Loops",
    # Block 3: Data Structures
    "Lists", "List Methods", "Tuples", "Sets", "Dictionaries",
    # Block 4: Modularity
    "Function Definition", "Arguments", "Return Values", "Variable Scope", "Recursion",
    # Block 5: Intermediate Mechanics
    "String Manipulation", "Error Handling", "File IO", "List Comprehensions", "Modules"
]

CONCEPT_TO_ID = {name: idx for idx, name in enumerate(CONCEPTS)}
ID_TO_CONCEPT = {idx: name for idx, name in enumerate(CONCEPTS)}

# The 5 curriculum blocks above were always implicit in CONCEPTS' grouping
# (see the comments), just never exposed as real data. Used to scope a
# tutoring session to a demoable, session-sized chunk (5 concepts) instead
# of the full 25 -- see serving/content_engine.py's session/block logic.
CONCEPT_BLOCKS = [
    {"name": "Fundamentals", "concepts": CONCEPTS[0:5]},
    {"name": "Control Flow", "concepts": CONCEPTS[5:10]},
    {"name": "Data Structures", "concepts": CONCEPTS[10:15]},
    {"name": "Modularity", "concepts": CONCEPTS[15:20]},
    {"name": "Intermediate Mechanics", "concepts": CONCEPTS[20:25]},
]

def build_python_dag():
    """
    Constructs the Directed Acyclic Graph (DAG) for the Python curriculum.
    Nodes are assigned deterministic integer IDs to ensure PyTorch tensor alignment.
    Edges represent prerequisite dependencies (Source -> Target).
    """
    G = nx.DiGraph()
    
    # Add nodes with integer IDs and concept name attributes
    for idx, name in enumerate(CONCEPTS):
        G.add_node(name, id=idx)
    
    # Define prerequisite relationships (Prerequisite -> Dependent Concept)
    edges = [
        # Block 1: Fundamentals (Roots)
        ("Syntax", "Variables"),
        ("Primitive Data Types", "Variables"),
        ("Variables", "Arithmetic Operators"),
        ("Variables", "Relational Operators"),
        
        # Block 2: Control Flow
        ("Relational Operators", "Conditionals"),
        ("Conditionals", "While Loops"),
        ("Variables", "For Loops"),
        ("For Loops", "Loop Control"),
        ("While Loops", "Loop Control"),
        ("For Loops", "Nested Loops"),
        
        # Block 3: Data Structures
        ("Primitive Data Types", "Lists"),
        ("Lists", "List Methods"),
        ("Lists", "Tuples"),
        ("Lists", "Sets"),
        ("Tuples", "Sets"),
        ("Variables", "Dictionaries"),
        
        # Block 4: Modularity
        ("Syntax", "Function Definition"),
        ("Variables", "Function Definition"),
        ("Function Definition", "Arguments"),
        ("Function Definition", "Return Values"),
        ("Function Definition", "Variable Scope"),
        ("Variables", "Variable Scope"),
        ("Function Definition", "Recursion"),
        ("Conditionals", "Recursion"),
        
        # Block 5: Intermediate Mechanics
        ("Primitive Data Types", "String Manipulation"),
        ("Lists", "String Manipulation"),
        ("Conditionals", "Error Handling"),
        ("String Manipulation", "File IO"),
        ("Variables", "File IO"),
        ("Lists", "List Comprehensions"),
        ("For Loops", "List Comprehensions"),
        ("Function Definition", "Modules")
    ]
    
    G.add_edges_from(edges)
    return G

# Backwards compatibility alias
build_python_knowledge_graph = build_python_dag

# Module-level instance so `from knowledge_graph.graph_builder import python_kg`
# (used by the data simulators and graph_representation.py) resolves on import.
python_kg = build_python_dag()


def analyze_failure_dependencies(graph, failed_node):
    """Finds all prerequisite concepts that might have caused a failure."""
    ancestors = nx.ancestors(graph, failed_node)
    return ancestors


# Prevent sanity checks and prints from running on import
if __name__ == "__main__":
    # 1. Check DAG validity
    is_dag = nx.is_directed_acyclic_graph(python_kg)
    print(f"Is valid DAG? {is_dag}")
    print(f"Total Concepts: {python_kg.number_of_nodes()}")
    print(f"Total Edges: {python_kg.number_of_edges()}")

    # 2. Extract Topological Sort
    if is_dag:
        safe_learning_path = list(nx.topological_sort(python_kg))
        print("\nBaseline Linear Learning Path (Topological Sort):")
        for i, node in enumerate(safe_learning_path, 1):
            print(f"{i}. {node} (ID: {CONCEPT_TO_ID[node]})")

    # 3. Analyze failure nodes
    nested_ancestors = analyze_failure_dependencies(python_kg, "Nested Loops")
    recursion_ancestors = analyze_failure_dependencies(python_kg, "Recursion")
    print(f"\nIf a student fails 'Nested Loops', check these prerequisites: {nested_ancestors}")
    print(f"If a student fails 'Recursion', check these prerequisitpython train_tracker.pyes: {recursion_ancestors}")