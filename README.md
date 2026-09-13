# REAL 材料预测平台

> Rare-Earth Absorption and Luminescence

面向课题组与同行的公开科研窗口，展示 Ce³⁺ 石榴石荧光/透明陶瓷研究中的真实数据口径、物理机制、模型路线和版本状态。

[打开 GitHub Pages](https://sunrytl.github.io/real-materials-showcase/) · [打开REAL数据库](https://sunrytl.github.io/real-materials-showcase/workbench#database) · [查看数据口径](#当前公开内容)

## REAL科研工作台

GitHub Pages提供无需本地后端的公开只读数据库科研图；私有模式继续在科研电脑／实验室私有网络运行，用于PDF上传、SHA-256查重、DOI确认、七表候选和审核。公开页不接收PDF和API密钥，并把文献整理明确交给Codex固定工作流。

- [私有工作台安装与使用](WORKBENCH_README.md)
- [产品定义](PRODUCT.md)
- [2026-09-12 REAL科研工作台设计说明](docs/superpowers/specs/2026-09-12-real-research-workbench-design.md)
- [阶段A：论文收件箱设计](docs/superpowers/specs/2026-09-12-real-workbench-stage-a-inbox-design.md)

## 当前公开内容

- 经审计的聚合统计：255 条总库记录、132 条正式核心候选、53 条严格 PL/PLE 配对；
- 19 个材料家族的核心集分布；
- 激发位置—弛豫损失—陶瓷观测修正的机制拆分；
- M0–M7 模型路线与当前状态；
- 输入字段完整度检查与模型层级判断；
- Zhuo、Jiang、Lee 三项关键工作的可核验 DOI。

统计来自私有研究库的脱敏审计结果。REAL数据库页包含用于科研图交互与复现的脱敏样品级字段（匿名样品ID、组成、家族、形态、PL、DOI、PCA坐标和字段覆盖），不包含原始PDF、权威Excel、密钥、个人信息或未审核实验记录。

## 模型边界

当前固定显示：

> 模型正在进行严格分组验证，暂不提供数值预测。

预测实验室只说明当前输入可以支持 M0 还是 M1，以及缺少哪些字段。正式模型通过 DOI、连续系列和材料家族分组验证后，才会发布预测值、不确定性、适用域、相似材料和模型版本。

## 本地运行

```bash
npm ci
npm run dev
```

完整验证：

```bash
npm test
npm run lint
```

## 部署

`main` 分支更新后，由 `.github/workflows/pages.yml` 构建并发布 `dist/` 到 GitHub Pages。

## 数据与引用

- 数据版本：`Ce3_Garnet_Ceramic_Database_clean_v1.3_20260725.xlsx`
- 核心口径：`core_dataset_flag == true AND core_rt_flag == true`
- 审计日期：2026-08-10

论文证据请通过网页中的 DOI 链接访问原始来源。公开站不转载论文图片。
