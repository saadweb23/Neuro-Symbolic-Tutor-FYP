#!/usr/bin/env bash
# Pushes the staged API to a Hugging Face Space (creating a normal fast-forward commit; no force-push).
#   HF_TOKEN   a Hugging Face access token with WRITE permission (never commit it)
#   HF_SPACE   "<username>/<space-name>" of an existing Docker Space
#   bash deploy/huggingface/deploy.sh
set -euo pipefail
: "${HF_TOKEN:?set HF_TOKEN}"; : "${HF_SPACE:?set HF_SPACE (username/space-name)}"
cd "$(dirname "$0")/../.."
bash deploy/huggingface/stage.sh build/hf-space
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
git clone --quiet "https://user:${HF_TOKEN}@huggingface.co/spaces/${HF_SPACE}" "$WORK/space"
find "$WORK/space" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R build/hf-space/. "$WORK/space/"
cd "$WORK/space"
git config user.name "${GIT_AUTHOR_NAME:-neurotutor-deploy}"; git config user.email "${GIT_AUTHOR_EMAIL:-deploy@users.noreply.github.com}"
git add -A
if git diff --cached --quiet; then echo "Space already up to date."; exit 0; fi
git commit --quiet -m "Deploy ${GITHUB_SHA:-$(git -C "$OLDPWD" rev-parse --short HEAD 2>/dev/null || echo local)}"
git push --quiet origin HEAD:main
echo "Pushed. The Space now rebuilds; watch https://huggingface.co/spaces/${HF_SPACE}"
