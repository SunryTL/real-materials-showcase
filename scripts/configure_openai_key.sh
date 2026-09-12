#!/bin/zsh
set -euo pipefail

echo "API Key只会写入本机macOS钥匙串，不会显示或写入Git。"
read -s "REAL_KEY?请输入OpenAI API Key："
echo
if [[ "$REAL_KEY" != sk-* ]]; then
  echo "Key格式看起来不正确，未保存。"
  exit 1
fi
security add-generic-password -U -a "$USER" -s "REAL_OPENAI_API_KEY" -w "$REAL_KEY" >/dev/null
unset REAL_KEY
echo "已保存。启动REAL时会从钥匙串临时读取。"
