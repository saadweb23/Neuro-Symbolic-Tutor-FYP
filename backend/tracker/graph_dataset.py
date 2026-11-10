import torch
import pandas as pd
from torch.utils.data import Dataset
from torch_geometric.utils import from_networkx
from knowledge_graph.graph_builder import CONCEPT_TO_ID

class StudentGraphDataset(Dataset):
    def __init__(self, csv_file, nx_graph, num_nodes=25, max_time=180.0):
        self.df = pd.read_csv(csv_file)
        self.num_nodes = num_nodes
        self.max_time = max_time
        
        # Identify columns
        possible_node_cols = ['concept', 'node_id', 'concept_name', 'skill']
        self.node_col = next((col for col in possible_node_cols if col in self.df.columns), None)
        
        possible_outcome_cols = ['passed', 'outcome', 'correct', 'is_correct']
        self.outcome_col = next((col for col in possible_outcome_cols if col in self.df.columns), None)
        
        possible_time_cols = ['time_taken', 'duration', 'response_time', 'time']
        self.time_col = next((col for col in possible_time_cols if col in self.df.columns), None)
        
        if not self.node_col or not self.outcome_col:
            raise ValueError(f"Required columns missing from CSV: {list(self.df.columns)}")

        # Ensure strict chronological sequence per student
        self.df = self.df.sort_values(by=['student_id', 'step'])
        self.student_ids = self.df['student_id'].unique()
        
        # Convert DAG topology to PyG edge indices
        pyg_graph = from_networkx(nx_graph)
        self.edge_index = pyg_graph.edge_index
        
        self.student_groups = self.df.groupby('student_id')

    def __len__(self):
        return len(self.student_ids)

    def __getitem__(self, idx):
        student_id = self.student_ids[idx]
        student_data = self.student_groups.get_group(student_id)
        
        sequence = []
        for _, row in student_data.iterrows():
            raw_node = row[self.node_col]
            node_id = CONCEPT_TO_ID[raw_node] if isinstance(raw_node, str) else int(raw_node)
            passed = int(row[self.outcome_col])
            
            # Normalize latency between 0.0 and 1.0
            raw_time = float(row[self.time_col]) if self.time_col else 60.0
            norm_time = min(raw_time / self.max_time, 1.0)
            
            # Isolated streams
            pass_mask = torch.zeros(self.num_nodes)
            fail_mask = torch.zeros(self.num_nodes)
            time_mask = torch.zeros(self.num_nodes, 1)
            
            time_mask[node_id] = norm_time
            if passed == 1:
                pass_mask[node_id] = 1.0
            else:
                fail_mask[node_id] = 1.0
                
            sequence.append({
                'target_node': node_id,
                'actual_outcome': torch.tensor(passed, dtype=torch.float32),
                'pass_mask': pass_mask,
                'fail_mask': fail_mask,
                'time_mask': time_mask
            })
            
        return sequence, self.edge_index