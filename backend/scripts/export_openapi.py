"""Writes the API's OpenAPI schema to frontend/app/openapi.json, from which the frontend
generates its TypeScript types:   python scripts/export_openapi.py && (cd ../frontend/app && npm run types)

Run from backend/. The app is only imported (the lifespan, which loads the models, does not run)."""
import json
import os
import sys

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)
os.environ.setdefault("USE_QUESTION_BANK", "true")

from main import app  # noqa: E402

out = os.path.join(os.path.dirname(BACKEND), "frontend", "app", "openapi.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(app.openapi(), f, indent=2, sort_keys=True)
    f.write("\n")
print(f"wrote {out}")
