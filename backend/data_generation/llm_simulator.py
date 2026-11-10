import os
import json
import csv
import time
import networkx as nx
import google.generativeai as genai
from dotenv import load_dotenv
import sys

# Add root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from knowledge_graph.graph_builder import python_kg

# Load API Key securely
load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# Initialize the Gemini model
model = genai.GenerativeModel('gemini-2.5-flash')

PROFILES = ["Fast Learner", "Struggling Learner", "Forgetful Learner"]

def generate_gemini_trajectory(student_id, profile, graph):
    """
    Calls the Gemini API to generate a full 25-step learning trajectory.
    """
    learning_path = list(nx.topological_sort(graph))
    
    # Map dependencies so the LLM understands the causal logic
    dependencies = {}
    for node in learning_path:
        prereqs = list(graph.predecessors(node))
        if prereqs:
            dependencies[node] = prereqs

    prompt = f"""
    You are a realistic student simulator navigating a Python programming curriculum.
    Your Learner Profile is: {profile}.
    
    The curriculum consists of these 25 concepts in this exact order: {learning_path}
    
    CRITICAL LOGIC RULES:
    These are the strict prerequisite dependencies: {dependencies}.
    If you simulate a failure (0) on a prerequisite concept, you MUST simulate a failure (0) on the dependent concept, unless the student makes a lucky guess (10% chance).
    
    Profile Guidelines:
    - 'Fast Learner': High pass rate, takes 30-60 seconds per question.
    - 'Struggling Learner': Fails often, struggles heavily with dependencies, takes 90-150 seconds.
    - 'Forgetful Learner': Passes early concepts, but pass rate drops significantly in the last 10 steps.
    
    Output a valid JSON array of exactly 25 objects representing this student's trajectory. Do not include markdown formatting like ```json. Output raw JSON only.
    Format each object exactly like this:
    {{
        "student_id": "{student_id}",
        "profile": "{profile}",
        "step": 1,
        "concept": "Syntax",
        "passed": 1,
        "time_taken": 45
    }}
    """
    
    try:
        response = model.generate_content(prompt)
        # Clean the response in case Gemini adds markdown code blocks
        raw_text = response.text.strip().removeprefix('```json').removesuffix('```').strip()
        trajectory = json.loads(raw_text)
        return trajectory
    except Exception as e:
        print(f"Error generating {student_id}: {e}")
        return None

def build_llm_dataset(num_students=1000, output_file="generated_logs.csv"):
    """
    Generates the dataset and saves incrementally to prevent data loss.
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(current_dir, output_file)
    
    print(f"Starting LLM simulation for {num_students} students...")
    print(f"Estimated time: ~2.5 to 3 hours. Data saves automatically after every student.")
    
    # Create the file and write the header first
    header_written = False

    for i in range(1, num_students + 1):
        profile = PROFILES[i % len(PROFILES)]
        student_id = f"STU_{i:04d}"
        
        print(f"[{i}/{num_students}] Prompting Gemini for {student_id} ({profile})...")
        trajectory = generate_gemini_trajectory(student_id, profile, python_kg)
        
        if trajectory:
            keys = trajectory[0].keys()
            
            # Append to the CSV immediately
            mode = 'a' if header_written else 'w'
            with open(out_path, mode, newline='') as output_csv:
                dict_writer = csv.DictWriter(output_csv, fieldnames=keys)
                if not header_written:
                    dict_writer.writeheader()
                    header_written = True
                dict_writer.writerows(trajectory)
                
            print(f"  -> Saved {student_id} successfully.")
            
        # Sleep for 5 seconds to strictly respect the 15 RPM free-tier limit
        time.sleep(5) 
        
    print(f"\nSuccess! All LLM data saved to {out_path}")

if __name__ == "__main__":
    # Starting with just 5 to test the API connection before running a massive batch
    build_llm_dataset(num_students=1000)