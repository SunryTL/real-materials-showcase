# REAL科研工作台阶段A｜论文收件箱设计

> 状态：待用户审阅  
> 日期：2026-09-12  
> 上位规范：[REAL科研工作台设计说明](2026-09-12-real-research-workbench-design.md)

## 1. 阶段目标

交付一个真实可运行的私有工作台入口，让孙瑞阳和同门能够：

1. 登录工作台；
2. 上传本地PDF，或扫描服务器配置的“未处理”文件夹；
3. 自动计算SHA-256并识别重复副本；
4. 从PDF文本提出DOI候选，由人确认；
5. 填写目标材料家族和需要补充的字段；
6. 在总览中看到文件数量、唯一论文候选、重复组、待确认DOI和下一动作。

阶段A不调用AI、不生成七表、不修改数据库。它把当前手工文件夹变成可审计的文献入口，为阶段B提供稳定的`document_id`、PDF哈希和确认DOI。

## 2. 页面与操作

### 2.1 登录页

- 显示REAL名称、私有工作台标识和“本机／局域网运行”状态。
- 用户输入账号和密码；错误时只提示“账号或密码不正确”，不泄露账号是否存在。
- 首次启动通过命令行创建负责人账号，不在网页显示默认密码。

### 2.2 工作台总览

首屏采用一条可操作的文献流水线：

```text
本地文件 13
→ 唯一PDF 11
→ DOI待确认
→ 可以进入蒸馏 0
```

数字实时来自API。页面同时显示：

- 当前扫描目录是否可访问；
- 最近五次上传／扫描操作；
- 重复文件组；
- 按上传人统计的本周贡献；
- “上传PDF”和“扫描未处理目录”两个主操作。

### 2.3 文献收件箱

高密度表格字段：

| 字段 | 页面含义 |
|---|---|
| 文件 | 原始文件名与文件大小 |
| 哈希 | SHA-256前12位，完整值可复制 |
| DOI | 自动候选、已确认或待填写 |
| 目标家族 | 本文计划补充的材料路线 |
| 目标字段 | PL、PLE、组成、工艺、晶格、CIF等 |
| 上传人 | 任务责任人 |
| 状态 | 重复、待确认、可以蒸馏 |
| 下一动作 | 当前唯一需要做的操作 |

支持按状态、上传人、DOI和目标家族筛选。移动端显示卡片摘要，字段编辑转到详情页。

### 2.4 上传面板

- 支持拖放和文件选择，可一次上传多个PDF。
- 每个文件在传输前显示名称和大小。
- 后端核验`.pdf`扩展名、`application/pdf`类型、PDF文件头和最大文件大小。
- 上传完成后立即返回唯一文档、重复副本或拒绝原因。
- 同哈希文件不复制第二份内容，只登记新的文件名、路径来源、上传人和时间。

### 2.5 文献详情

- 左侧显示文件元数据、哈希、上传来源和重复位置。
- 中间显示从PDF文本识别的DOI候选及其出现位置。
- 右侧填写确认DOI、目标家族和目标字段。
- 只有DOI格式合法且由用户确认后，状态才变为`ready_for_extraction`。
- “开始AI蒸馏”在阶段A显示为下一阶段能力，并保持禁用。

## 3. 数据模型

SQLite只保存工作流元数据，不保存论文全文内容和科研数值。

### `users`

```text
id, username, display_name, password_hash, role, active, created_at
```

角色为`owner`或`contributor`。阶段A两者都可上传和编辑文献元数据；只有`owner`可创建或停用账户。

### `documents`

一份唯一PDF内容一行：

```text
id, sha256, size_bytes, canonical_filename,
doi_candidate, doi_confirmed, doi_confirmation_status,
target_family, target_fields_json, workflow_status,
created_by, created_at, updated_at
```

`sha256`建立唯一约束。`workflow_status`限定为：

```text
fingerprinted
metadata_needs_review
ready_for_extraction
```

### `document_locations`

同一内容的每个文件副本或上传来源一行：

```text
id, document_id, original_filename, source_type,
managed_relative_path, observed_by, observed_at
```

`source_type`限定为`uploaded`或`scanned_local`。API不返回真实绝对路径，只返回文件名和受控相对标识。

### `audit_events`

```text
id, actor_id, action, entity_type, entity_id,
before_json, after_json, created_at
```

上传、扫描、DOI确认和元数据修改均记录事件。

## 4. 文件规则

- 后端只允许访问配置中的`REAL_PDF_INBOX_ROOT`和`REAL_RUNTIME_ROOT`。
- 上传文件名经过清理，不能包含路径分隔符或控制字符。
- 文件先写入运行目录中的临时文件，完成PDF验证和哈希后再原子移动。
- 相同哈希不重复保存；现有重复副本只登记，不自动删除。
- 符号链接、越界路径和非PDF内容均拒绝。
- 默认最大文件为100 MB；该值只能由后端配置修改。
- PDF全文、解析文本和绝对路径不写入日志或浏览器错误信息。

## 5. DOI识别规则

- 后端读取PDF前五页和文档元数据，使用标准DOI正则提取候选。
- 去除`https://doi.org/`和`doi:`前缀，统一小写比较。
- 同一PDF出现多个DOI时全部展示，并说明出现页码或元数据位置。
- 自动识别只产生候选；用户必须点击确认。
- 没有DOI或属于补充材料时，用户可选择“关联父论文”，填写父论文DOI。
- DOI确认后才允许进入阶段B蒸馏队列。

## 6. API合同

| 方法 | 路径 | 输入与返回 |
|---|---|---|
| `POST` | `/api/v1/session/login` | 账号密码；设置HttpOnly会话Cookie |
| `POST` | `/api/v1/session/logout` | 注销当前会话 |
| `GET` | `/api/v1/session/me` | 当前用户、显示名和角色 |
| `GET` | `/api/v1/dashboard` | 文件、唯一哈希、重复组、DOI状态和本周贡献 |
| `GET` | `/api/v1/documents` | 分页、筛选后的文献列表 |
| `POST` | `/api/v1/documents` | 多文件上传；逐文件返回结果 |
| `POST` | `/api/v1/documents/scan` | 扫描固定未处理目录 |
| `GET` | `/api/v1/documents/{id}` | 文献、位置、DOI候选和审计事件 |
| `PATCH` | `/api/v1/documents/{id}` | 确认DOI、目标家族和目标字段 |

所有接口使用统一错误结构：

```json
{
  "error": {
    "code": "duplicate_pdf",
    "message": "该PDF内容已经登记",
    "field": "file",
    "request_id": "..."
  }
}
```

## 7. 仓库结构

```text
real-materials-showcase/
├── src/
│   ├── public-site/              现有公开页面
│   ├── workbench/                私有工作台页面与组件
│   └── shared/                   REAL设计令牌和通用组件
├── server/
│   ├── app.py                    FastAPI入口
│   ├── config.py                 受控目录和运行设置
│   ├── auth.py                   本地账户与会话
│   ├── documents.py              上传、扫描、哈希和DOI识别
│   ├── database.py               SQLite连接与迁移
│   └── schemas.py                请求与响应模型
├── scripts/
│   ├── start_workbench.py        一条命令启动前后端
│   └── create_workbench_user.py  创建本地用户
├── tests/
│   ├── server/                   后端安全和数据测试
│   └── workbench/                前端状态和交互测试
└── docs/superpowers/specs/
```

现有公开`App.tsx`在实施时移动到`src/public-site/`，行为和视觉保持不变。该移动必须由现有8项测试和新增公开构建测试保护。

## 8. 本地启动方式

阶段A完成后的唯一入口为：

```bash
conda run -n real-materials-m0 python scripts/start_workbench.py
```

启动器检查：

1. Conda环境与Python依赖；
2. Node依赖；
3. 两个受控目录；
4. 本地数据库迁移；
5. 是否存在负责人账号；
6. 后端与前端端口是否可用。

默认只监听`127.0.0.1`。负责人显式添加`--lan`后监听局域网，并在终端打印访问地址和安全提醒。

## 9. 测试与验收

### 后端

- 临时目录中上传一个PDF，可得到正确SHA-256和一条`documents`记录。
- 再上传相同内容，只新增`document_locations`，不新增文档或重复文件内容。
- 扫描目录中的13个PDF，得到11个唯一文档和2个重复组。
- 非PDF、伪造扩展名、超过大小限制、符号链接和路径越界被拒绝。
- DOI候选可从元数据和正文前五页识别；多DOI不会自动选定。
- 未确认DOI的记录不能进入`ready_for_extraction`。
- 密码以安全哈希保存，会话Cookie为HttpOnly且具有过期时间。
- API响应和日志不包含API Key、密码、全文或绝对路径。

### 前端

- 未登录用户不能进入工作台路由。
- 上传、扫描、重复、待确认和可蒸馏状态均有可读反馈。
- 13个文件／11个唯一PDF／2个重复组的真实盘点能够正确显示。
- 表格筛选、详情修改和错误恢复可以通过键盘完成。
- 桌面端完成上传和编辑；移动端可以查看状态和完成DOI确认。

### 公开构建

- 默认`npm run build`仍只生成公开模式。
- 公开产物中不存在工作台路由、API地址、绝对路径、用户数据或私有配置。
- 现有8项公开站测试、构建和lint全部通过。

## 10. 阶段完成定义

阶段A只有在以下证据同时存在时才完成：

1. 本机启动命令成功；
2. 真实未处理目录扫描结果为13个文件、11个唯一哈希、2个重复组；
3. 新上传PDF和重复上传均通过浏览器实测；
4. 两个测试账户可以登录并看到各自操作记录；
5. GitHub Pages公开构建没有私有能力或数据泄露；
6. 后端、前端、公开构建和安全测试全部通过；
7. 提供桌面端和移动端截图以及GitHub PR；
8. 用户检查后回复“无误继续”。
