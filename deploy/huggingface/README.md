---
title: NeuroTutor API
emoji: 🧊
colorFrom: indigo
colorTo: teal
sdk: docker
app_port: 7860
pinned: false
short_description: FastAPI backend of the NeuroTutor adaptive Python tutor
---

# NeuroTutor API

FastAPI backend (Dual-GCN mastery tracker, PPO concept selection, rule-based content engine) for the
NeuroTutor adaptive Python tutor. Interactive API documentation is at `/docs`, liveness at `/health`.

This Space is generated from the project's GitHub repository (`deploy/huggingface/`); edit the code
there, not here. Student progress is stored in an external PostgreSQL database, configured through the
`DATABASE_URL` secret. Set the `CORS_ORIGINS` variable to the website that calls this API.
