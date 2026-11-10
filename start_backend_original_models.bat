@echo off
rem Starts the backend with the ORIGINAL tracker + PPO (rollback from the v2 models).
cd /d "%~dp0backend"
set "TRACKER_CHECKPOINT=%~dp0backend\tracker\dual_gcn_weights_v1.pth"
set "PPO_CHECKPOINT=%~dp0backend\agent\ppo_tutor.zip"
python -m uvicorn main:app --host 0.0.0.0 --port 8000
