#!/bin/zsh
set -euo pipefail

CONDA_BIN="${CONDA_BIN:-/Users/sunry/miniforge3/bin/conda}"
if [[ ! -x "$CONDA_BIN" ]]; then
  echo "未找到Conda：$CONDA_BIN"
  exit 1
fi

"$CONDA_BIN" install -n real-materials-m0 -c conda-forge --strict-channel-priority -y \
  fastapi uvicorn python-multipart pypdf openai httpx pydantic pyyaml openpyxl pytest
echo "REAL工作台依赖已安装到Conda环境 real-materials-m0"
