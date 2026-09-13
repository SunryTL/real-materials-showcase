#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
REPO_ROOT="${SCRIPT_DIR:h}"
CONDA_BIN="${CONDA_BIN:-/Users/sunry/miniforge3/bin/conda}"
export PYTHONPATH="$REPO_ROOT/server"

ROLE="${3:-contributor}"
"$CONDA_BIN" run -n real-materials-m0 python -m real_workbench.cli create-user \
  --username "${1:?用法：scripts/create_workbench_user.sh 账号 显示名 owner|contributor}" \
  --display-name "${2:?请提供显示名}" \
  --role "$ROLE"
