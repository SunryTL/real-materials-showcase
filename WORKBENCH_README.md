# REAL私有科研工作台｜从这里开始

REAL公开页面部署在GitHub Pages；私有工作台运行在科研电脑上。PDF、API Key、候选七表和权威Excel不会进入公开构建。

- 公开科研图：`https://sunrytl.github.io/real-materials-showcase/workbench#database`
- 公开文献入口：`https://sunrytl.github.io/real-materials-showcase/workbench#inbox`

公开页直接读取仓库内的版本化脱敏数据包，不依赖本机FastAPI或8000端口。文献入口只提供固定Codex任务模板，不显示无法在GitHub Pages执行的假上传或假蒸馏按钮。

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
→ 负责人明确确认发布 → 本地不可变新快照 → 自动读取更新后的科研图
```

AI输出只保存到`REAL_CANDIDATE_ROOT`。工作台没有覆盖权威数据库的接口。

## 学术科研图

“数据库状态”页按三个科学问题组织，不再强制六幅图拼接：

- 数据里有什么：连续发射分布、Three.js 可旋转点云、联合散点与边际密度；
- 数据质量如何：完整度、真实缺失矩阵、低支持留空的相关结构；
- 数据能支持什么：独立 DOI／样品／系列的并列证据、分层模型字段资格。

家族、形态、状态、版本共用 `/api/v1/explorer` 后端统计。点选样品可追溯 DOI，二维与三维联动。每幅图使用同一个 Canvas 函数显示与导出4200px PNG，并下载对应统计CSV。母版只约束细点、柔和轮廓、平滑密度和配色，不提供数据；不造点、不抖动重合坐标。历史六面板PNG仅折叠归档，不代表新快照。

默认正式范围；候选和混合预览有独立标记。发布要求负责人身份、完整七表校验、明确确认，审核与校验均绑定当前包哈希。修改后必须重新审核。快照存 `REAL_RUNTIME_ROOT/database_snapshots/`，从不覆盖权威Excel；生成/发布失败保留旧指针。每次点击重新读取数据，版本与来源指纹决定重新计算或复用相同统计。

当前全库255条、42 DOI、24原始家族标签；核心132条、27 DOI、19汇报家族是不同范围。当前发射分布170条、联合散点132条、点云131条。缺描述符的新记录不会凭空加入点云；相同完整组成且描述符向量一致时可复用组成描述符，未知组成仍需计算/审核。PCA不是已验证模型。

新增接口：`GET /api/v1/explorer`、`GET /api/v1/database/versions`、`POST /api/v1/database/publish`。原图集任务/版本/资源接口保留为归档生成机制。视觉规范唯一来源为科研库 `research/code/reporting/JOURNAL_DATABASE_STYLE.md`。

本地可视化不需要API Key；真实PDF蒸馏需要后端 `OPENAI_API_KEY` 和逐篇确认。未配置时页面明确显示待配置，不生成假的提取结果。

## GitHub Pages静态数据发布

公开数据包由科研主库的单一统计实现生成，展示仓库不重算科研统计：

```bash
cd /Users/sunry/Documents/real-materials-research
conda run -n real-materials-pubfig python -m research.code.reporting.public_real_release \
  --snapshot-root research/data_snapshot \
  --authority-workbook "/本机权威数据库.xlsx" \
  --output-root /Users/sunry/Documents/real-materials-showcase/public/workbench/public-data \
  --version v1.3_20260725
```

生成物包括`latest.json`、不可变版本manifest及每个正式筛选范围的预计算图表数据。manifest登记数据库版本、源哈希、绘图规范和隐私声明。只有审核后的正式快照允许运行此命令；候选包不进入公开统计。

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
