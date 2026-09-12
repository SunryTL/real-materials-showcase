# REAL私有科研工作台｜从这里开始

REAL公开页面继续部署在GitHub Pages；私有工作台运行在科研电脑上。PDF、API Key、候选七表和权威Excel不会进入公开构建。

## 第一次安装

```bash
cd /Users/sunry/Documents/real-materials-showcase
scripts/setup_workbench_env.sh
scripts/create_workbench_user.sh sunry 孙瑞阳 owner
scripts/configure_openai_key.sh
```

密码在终端中隐藏输入。API Key保存到macOS钥匙串，不写入代码、浏览器或Git。

## 启动

```bash
scripts/run_workbench.sh
```

- 本机：`http://127.0.0.1:5173/real-materials-showcase/workbench`
- 同门：连接同一Tailscale网络后，打开`http://本机Tailscale-IP:5173/real-materials-showcase/workbench`

负责人可为同门创建独立账号：

```bash
scripts/create_workbench_user.sh shidi 师弟 contributor
```

多人共用同一工作台，每个人使用自己的账号。API费用由本机后端的课题组Key统一承担；Key不会发给成员。

## 真实工作流

```text
上传PDF／扫描00_未处理
→ SHA-256查重与DOI候选
→ 人工确认DOI、目标家族和字段
→ 逐篇确认发送给OpenAI
→ 按GitHub固定schema生成七表候选包
→ 网页逐字段审核并运行论文库校验器
→ 保存核心／辅助／排除建议
→ 形成新数据库版本候选
```

AI输出只保存到`REAL_CANDIDATE_ROOT`。工作台没有覆盖权威数据库的接口。

## 学术科研图

“工作台”和“数据库状态”页直接展示四组由冻结统计与M0正式结果生成的多面板科研图：

- 本周数据准备与证据层级；
- PDF到候选数据库的可追溯蒸馏流程；
- 19类家族的发射分布、独立DOI与字段覆盖；
- M0五模型指标、实测—预测、残差与五轮稳定性。

网页科研图统一以高清`PNG`展示和下载。图中保留原始数据、流程和模型指标，只按论文配图规范重绘视觉样式。网页只分发聚合统计和模型结果，不包含受限论文正文、银行卡、API Key或权威Excel。

## 默认本地目录

| 环境变量 | 默认位置 | 用途 |
|---|---|---|
| `REAL_PDF_INBOX_ROOT` | `研究工作/01_文献/00_未处理` | 本地PDF |
| `REAL_CANDIDATE_ROOT` | `研究工作/02_数据库/01_单篇提取表` | 七表候选包 |
| `REAL_RUNTIME_ROOT` | `~/Library/Application Support/REAL/workbench` | SQLite、会话和任务日志 |
| `REAL_PAPER_VAULT_ROOT` | `~/Documents/real-materials-paper-vault` | 七表schema和完整校验器 |
| `REAL_RESEARCH_ROOT` | `~/Documents/real-materials-research` | 脱敏统计和模型成果 |

## 验证

```bash
PYTHONPATH=server conda run -n real-materials-m0 python -m pytest server/tests -q
npm test
npm run lint
```

公开构建只包含聚合数据和前端代码。运行数据库、PDF、账号、Key和绝对路径均被Git忽略并在测试中检查。
