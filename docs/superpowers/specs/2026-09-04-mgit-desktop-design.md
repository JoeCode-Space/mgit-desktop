# mgit 跨平台桌面端（Rust + Tauri + React）设计文档

## 1. 概述与设计目标

`mgit` 是一款专为多仓库（Multi-Repo）项目设计的协同管理工具。为了提供极致性能、轻量低耗、现代优雅的交互体验，本项目构建一套基于 **Rust + Tauri 2.x** 后端与 **React 19 + TypeScript + TailwindCSS** 前端的独立桌面版客户端。

该桌面端深度兼容现有的 `mgit.yaml` 规格，具备毫秒级批量并发 Git 命令执行能力，支持仓库深度扫描、模块分组、状态聚合监控、多选批量 Git 操作（Pull/Push/Checkout/Merge/Commit）、实时彩色日志终端以及深浅色主题无缝切换。

---

## 2. 总体架构与技术选型

### 2.1 技术栈基线

* **桌面容器与后端**：Rust (edition 2021+), Tauri 2.x
  * 轻量级跨平台 WebView 封装（macOS 下使用 WebKit，Windows 下使用 WebView2，Linux 下使用 WebKitGTK）。
  * 后端采用多线程任务调度，提供安全的本地文件系统与命令行控制。
* **前端展示层**：React 19, TypeScript, Vite, TailwindCSS
  * 图标库：`lucide-react`。
  * 组件与状态设计：响应式布局、深浅色模式自适应、虚拟化/高精表格。
* **数据持久化与配置**：
  * 项目级配置文件：`mgit.yaml`（兼容 Go 版与 IntelliJ 插件版）。
  * 解析器：`serde_yaml` 与 `serde`。

### 2.2 目录组织结构

```
mgit-desktop/
├── src-tauri/                 # Tauri 2.x / Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json        # 桌面窗口、安全策略与插件配置
│   ├── capabilities/          # Tauri v2 权限能力配置
│   └── src/
│       ├── main.rs            # Tauri 入口点与 Command 注册路由
│       ├── lib.rs             # 库入口，初始化 Tauri App Builder
│       ├── models.rs          # 核心数据结构与序列化契约
│       ├── config.rs          # mgit.yaml 加载、保存与模块管理
│       ├── scanner.rs         # 目录遍历与多仓库自动发现
│       └── git/
│           ├── mod.rs
│           ├── executor.rs    # 单仓库 Git 命令封装与安全执行
│           └── operations.rs  # 批量并发操作 (Status/Pull/Push/Checkout/Merge/Commit)
├── src/                       # 前端 React SPA
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css          # Tailwind 样式与主题变量
│   │   ├── types/
│   │   │   └── index.ts       # 领域数据类型声明
│   │   ├── hooks/
│   │   │   ├── useMgit.ts     # 核心业务逻辑与 Tauri Command 绑定
│   │   │   └── useTheme.ts    # 深浅色主题切换
│   │   ├── components/
│   │   │   ├── Header.tsx     # 顶部工具栏（工作区选择、模块切换、全局操作按钮）
│   │   │   ├── RepoTable.tsx  # 仓库状态表格（分支、Dirty 标识、最新提交、操作栏）
│   │   │   ├── LogDrawer.tsx  # 底部可折叠的控制台日志
│   │   │   └── modals/
│   │   │       ├── ScanModal.tsx     # 目录智能扫描与生成分组弹窗
│   │   │       ├── CheckoutModal.tsx # 切分支/新建分支弹窗
│   │   │       ├── MergeModal.tsx    # 分支合并弹窗
│   │   │       ├── CommitModal.tsx   # 批量提交并推送弹窗
│   │   │       └── ModuleModal.tsx   # 模块与仓库管理配置弹窗
```

---

## 3. 核心业务与数据契约

### 3.1 配置文件协议 (`mgit.yaml`)

完全保持与已定义规范 100% 兼容：
```yaml
modules:
  root:
    - ./
  services:
    - services/order-service
    - services/payment-service
  apps:
    - apps/web-portal
```

### 3.2 数据模型契约 (Rust ↔ TypeScript)

```typescript
// 仓库状态模型
export interface RepoStatus {
  name: string;          // 仓库名称 (文件夹名)
  path: string;          // 仓库绝对路径
  relativePath: string;  // 相对于工作区根目录的相对路径
  branch: string;        // 当前分支名称
  dirty: boolean;        // 是否有未暂存/未提交的代码变动
  ahead: number;         // 领先远程分支的提交数
  behind: number;        // 落后远程分支的提交数
  latestCommit: string;  // 最新一条 commit 摘要
}

// Git 单项操作执行结果
export interface GitOpResult {
  repo: string;
  success: boolean;
  message: string;
  rawOutput?: string;
  error?: string;
}

// 日志事件推送
export interface LogEvent {
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  repo?: string;
  message: string;
}
```

---

## 4. 后端核心逻辑设计

### 4.1 Git 命令执行器 (`git/executor.rs`)
* 封装基于 `std::process::Command` 的安全执行逻辑。
* 每一个执行指令均限定在给定的仓库绝对路径下执行，避免路径穿越。
* 获取状态：
  * 分支名称：`git rev-parse --abbrev-ref HEAD`
  * 工作区变动：`git status --porcelain`
  * 领先/落后：`git rev-list --left-right --count HEAD...@{u}`（若无 upstream 则返回 0）
  * 最新提交：`git log -1 --format=%h %s`

### 4.2 批量并发操作引擎 (`git/operations.rs`)
* 采用 `rayon` 或 Tokio 任务池并发调度子仓库任务，避免单仓库耗时阻塞整体。
* 每个子任务产出阶段性日志，通过 Tauri 窗口事件 `app.emit("mgit://log", payload)` 发送到前端。
* 核心批量接口：
  * `batch_get_status(workspace, repos)`
  * `batch_pull(workspace, repos)`
  * `batch_push(workspace, repos)`
  * `batch_checkout(workspace, repos, target_branch, create_new, base_branch)`
  * `batch_merge(workspace, repos, source_branch)`
  * `batch_commit(workspace, repos, message, also_push)`

### 4.3 智能扫描器 (`scanner.rs`)
* 遍历目标工作区，寻找包含 `.git` 的子目录。
* 自动过滤高噪目录：`.git`、`node_modules`、`target`、`build`、`dist`、`.idea`、`.vscode`。
* 命名规则：若包含 `.git` 的目录就是根目录，归类到 `root` 模块；若处于多级子目录，提取第一级子目录名称作为 module 名称，将同模块下的所有仓库自动聚集。
* 支持预览扫描结果后再一键同步至 `mgit.yaml`。

---

## 5. 前端界面与交互设计

1. **Header 顶部导航**：
   - 当前工作区路径展示与点击切换工作区（调用系统文件夹选择器）。
   - 模块下拉选择器（支持快速切换、添加/编辑/删除模块）。
   - 快捷动作按钮栏：
     - `Scan`：扫描子目录 Git 仓库并生成/更新 `mgit.yaml`。
     - `Refresh`：并发刷新当前模块下所有仓库的最新状态。
     - `Pull`：一键批量拉取。
     - `Push`：一键批量推送。
     - `Checkout`：分支切换与新建分支弹窗。
     - `Merge`：分支合并弹窗。
     - `Commit`：批量快速提交并推送。
   - 主题切换器（深色 / 浅色模式）。
2. **RepoTable 仓库核心展示列表**：
   - 支持全选 / 反选复选框（允许用户指定只对选中的部分仓库进行操作）。
   - 仓库名称、相对路径、当前所在分支、Dirty 状态徽章（绿色 Clean / 橙色 Dirty）。
   - 单仓快捷操作：打开系统终端、在文件管理器中定位、单独拉取/推送。
3. **LogDrawer 实时日志控制台**：
   - 底部抽屉，支持一键展开/折叠和清空日志。
   - 区分 Info、Success、Warning、Error 颜色高亮。
   - 包含自动滚动至底部开关。

---

## 6. 测试与验证策略

1. **Rust 单元测试**：
   - `config_test`：测试 `mgit.yaml` 的正反序列化与模块追加写入。
   - `scanner_test`：在临时目录生成多层级带有 `.git` 的虚拟仓库树，验证是否正确识别分组与过滤 `node_modules`。
   - `git_executor_test`：测试 Git 命令解析与错误处理。
2. **端到端应用构建与运行验证**：
   - 验证 `npm run build` 前端构建无 TypeScript / 样式警告。
   - 验证 `cargo check` 及 Tauri 桌面打包编译。
   - 启动桌面端，测试扫描实际工作区、读取 `mgit.yaml`、查看状态及执行 Git 操作。
