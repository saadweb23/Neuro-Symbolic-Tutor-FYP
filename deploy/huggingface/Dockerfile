# NeuroTutor API for a Hugging Face "Docker" Space (free CPU Basic: 2 vCPU, 16 GB RAM).
# The Space repo is produced by deploy/huggingface/stage.sh: this file and README.md at its root and
# the API source under backend/.  Student data is NOT stored in the container (its disk is
# ephemeral): set the DATABASE_URL secret to a PostgreSQL database (Neon free tier).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    NEURO_ENV=production \
    USE_QUESTION_BANK=true \
    LOG_LEVEL=INFO \
    OMP_NUM_THREADS=2 \
    MKL_NUM_THREADS=2

# Spaces run the container as uid 1000
RUN useradd -m -u 1000 user
WORKDIR /home/user/app

# dependencies first, so source-only changes rebuild in seconds (CPU-only PyTorch, see the file)
COPY --chown=user backend/requirements-prod.txt ./requirements-prod.txt
RUN pip install --upgrade pip && pip install -r requirements-prod.txt

COPY --chown=user backend/ ./
USER user

# The Space router sends traffic to app_port (7860, see README.md). Models load before the port
# opens (about 30-60 s), so the first request after a cold start is slow.
EXPOSE 7860
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
