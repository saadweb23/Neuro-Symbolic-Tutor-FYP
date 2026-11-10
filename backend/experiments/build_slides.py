# -*- coding: utf-8 -*-
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

DECK = r"E:\Sohaib Uni Material\FYP\Presentations and stuff\working.pptx"
OUT = r"E:\Sohaib Uni Material\FYP\Presentations and stuff\Neuro-Symbolic Tutor Graph-Based RL for Dynamic STEM Remediation-FYP 3rd Evaluation.pptx"
EV = r"E:\Sohaib Uni Material\FYP\neuro_symbolic_tutor\backend\experiments\evidence"
ROOT = r"E:\Sohaib Uni Material\FYP\neuro_symbolic_tutor"

NAVY = RGBColor(0x1E, 0x27, 0x61)
ICE = RGBColor(0xCA, 0xDC, 0xFC)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
DARK_TEXT = RGBColor(0x1A, 0x1A, 0x1A)
GREEN = RGBColor(0x2C, 0x5F, 0x2D)
AMBER = RGBColor(0xB8, 0x86, 0x00)

PHASES = [
    {
        "slide_idx": 6,
        "title": "Review of FYP Progress: Phase 1 -- Knowledge Graph and Synthetic Data Generation",
        "rows": [
            ("Construct a directed Python-concept Knowledge Graph (20-30 nodes) with explicit prerequisite edges using NetworkX",
             "Achieved"),
            ("Generate synthetic student learning trajectories across multiple learner profiles to address data scarcity",
             "Achieved"),
        ],
        "image": f"{ROOT}\\dag_visual.png",
        "caption": "Constructed Python Knowledge Graph (25 concepts, directed prerequisite edges)",
    },
    {
        "slide_idx": 7,
        "title": "Review of FYP Progress: Phase 2 -- Diagnostic Tracker (Dual-GCN)",
        "rows": [
            ("Implement dual-stream (positive/negative) feature extraction to avoid signal confusion",
             "Achieved"),
            ("Model temporal knowledge state via GRU-based hidden state updates",
             "Achieved"),
            ("Achieve tracing accuracy of AUC > 0.80 on held-out students",
             "In Progress -- best result achieved: 0.7363 AUC (1000-student training run)"),
        ],
        "image": f"{EV}\\phase2_tracker_auc.png",
        "caption": "Dual-GCN validation AUC across training epochs",
    },
    {
        "slide_idx": 8,
        "title": "Review of FYP Progress: Phase 3 -- Intervention Agent (PPO)",
        "rows": [
            ("Define the tutoring process as an MDP: state = graph-derived mastery vector, action = remedial content, reward = learning efficiency",
             "Achieved"),
            ("Implement PPO actor-critic training with a clipped surrogate objective",
             "Achieved"),
            ("Outperform a standard linear curriculum on remediation efficiency (steps-to-mastery)",
             "In Progress"),
        ],
        "image": f"{EV}\\phase3_ppo_convergence.png",
        "caption": "PPO remediation agent: value function convergence during training",
    },
    {
        "slide_idx": 9,
        "title": "Review of FYP Progress: Phase 4 -- System Integration and Web Deployment",
        "rows": [
            ("Build a FastAPI backend serving the Dual-GCN and PPO models for real-time inference",
             "Achieved"),
            ("Build a responsive React web application (PC and mobile) with explainable, glass-box feedback",
             "In Progress -- a functional prototype is ready; further interactivity and UI refinement planned"),
        ],
        "image": f"{EV}\\app_main_loop.png",
        "caption": "Working prototype: adaptive learning loop with explainable feedback",
    },
    {
        "slide_idx": 10,
        "title": "Review of FYP Progress: Phase 5 -- Evaluation and Validation Framework",
        "rows": [
            ("Tracing Accuracy -- evaluate Dual-GCN predictive accuracy on held-out students",
             "Achieved"),
            ("Policy Convergence -- monitor PPO training stability and reward trends",
             "Achieved"),
            ("Remediation Efficiency -- benchmark steps-to-mastery against a linear curriculum baseline",
             "Achieved"),
        ],
        "image": f"{ROOT}\\Conventional Metrics.png",
        "caption": "Synthetic dataset validation -- class balance, profile representation, and concept-difficulty checks",
    },
]


def set_title(slide, text):
    for shp in slide.shapes:
        if shp.has_text_frame and shp.is_placeholder and shp.placeholder_format.type == 13:  # TITLE fallback
            pass
    title_shape = slide.shapes.title
    if title_shape is not None:
        p = title_shape.text_frame.paragraphs[0]
        if p.runs:
            p.runs[0].text = text
        else:
            p.text = text
        for run in p.runs:
            run.font.size = Pt(24)


def add_table(slide, rows, left, top, width, height):
    n_rows = len(rows) + 1
    gfx = slide.shapes.add_table(n_rows, 2, left, top, width, height)
    table = gfx.table
    table.columns[0].width = Emu(int(width * 0.55))
    table.columns[1].width = Emu(int(width * 0.45))

    headers = ["Objective", "Status"]
    for c, h in enumerate(headers):
        cell = table.cell(0, c)
        cell.text = h
        cell.fill.solid()
        cell.fill.fore_color.rgb = NAVY
        cell.margin_top = Pt(6)
        cell.margin_bottom = Pt(6)
        cell.margin_left = Pt(8)
        cell.margin_right = Pt(8)
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        para = cell.text_frame.paragraphs[0]
        para.runs[0].font.size = Pt(14)
        para.runs[0].font.bold = True
        para.runs[0].font.color.rgb = WHITE

    for r, (obj_text, status_text) in enumerate(rows, start=1):
        obj_cell = table.cell(r, 0)
        obj_cell.text = obj_text
        status_cell = table.cell(r, 1)
        status_cell.text = status_text

        for cell, is_status in ((obj_cell, False), (status_cell, True)):
            cell.fill.solid()
            cell.fill.fore_color.rgb = WHITE if r % 2 == 1 else RGBColor(0xF2, 0xF4, 0xFA)
            cell.margin_top = Pt(6)
            cell.margin_bottom = Pt(6)
            cell.margin_left = Pt(8)
            cell.margin_right = Pt(8)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            para = cell.text_frame.paragraphs[0]
            para.runs[0].font.size = Pt(12.5)
            para.runs[0].font.color.rgb = DARK_TEXT
            if is_status:
                if status_text.startswith("Achieved"):
                    para.runs[0].font.color.rgb = GREEN
                    para.runs[0].font.bold = True
                elif status_text.startswith("In Progress"):
                    para.runs[0].font.color.rgb = AMBER
                    para.runs[0].font.bold = True
    return gfx


def add_evidence_image(slide, image_path, caption, left, top, max_width, max_height):
    pic = slide.shapes.add_picture(image_path, left, top, width=max_width)
    if pic.height > max_height:
        scale = max_height / pic.height
        pic.height = int(pic.height * scale)
        pic.width = int(pic.width * scale)
    pic.left = int(left + (max_width - pic.width) / 2)
    pic.top = int(top + (max_height - pic.height) / 2)

    cap_top = top + max_height + Pt(6)
    tb = slide.shapes.add_textbox(left, cap_top, max_width, Pt(28))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run = p.add_run()
    run.text = caption
    run.font.size = Pt(10.5)
    run.font.italic = True
    run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)


prs = Presentation(DECK)

LEFT_MARGIN = Inches(0.5)
TOP = Inches(1.55)
TABLE_WIDTH = Inches(7.3)
IMG_LEFT = Inches(8.1)
IMG_WIDTH = Inches(4.7)
IMG_MAX_HEIGHT = Inches(4.2)

for phase in PHASES:
    slide = prs.slides[phase["slide_idx"]]
    set_title(slide, phase["title"])
    n_rows = len(phase["rows"]) + 1
    row_h = Inches(0.95) if n_rows <= 3 else Inches(0.8)
    table_height = Emu(int(row_h) * n_rows)
    add_table(slide, phase["rows"], LEFT_MARGIN, TOP, TABLE_WIDTH, table_height)
    add_evidence_image(slide, phase["image"], phase["caption"], IMG_LEFT, TOP, IMG_WIDTH, IMG_MAX_HEIGHT)

prs.save(OUT)
print("saved:", OUT)
