#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
REPO_ROOT="${SCRIPT_DIR:h}"
CONDA_BIN="${CONDA_BIN:-/Users/sunry/miniforge3/bin/conda}"
export PYTHONPATH="$REPO_ROOT/server"

if [[ -z "${OPENAI_API_KEY:-}" ]] && command -v security >/dev/null 2>&1; then
  OPENAI_API_KEY="$(security find-generic-password -a "$USER" -s REAL_OPENAI_API_KEY -w 2>/dev/null || true)"
  export OPENAI_API_KEY
fi

cd "$REPO_ROOT"
"$CONDA_BIN" run -n real-materials-m0 uvicorn real_workbench.app:app \
  --app-dir server --host 0.0.0.0 --port 8000 &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' EXIT INT TERM

npm run dev -- --host 0.0.0.0
