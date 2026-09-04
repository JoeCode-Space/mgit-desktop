# mgit 跨平台桌面端（Rust + Tauri + React）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建基于 Rust + Tauri 2.x 与 React + TypeScript + TailwindCSS 的 `mgit` 跨平台桌面端应用，提供目录扫描、多模块分组管理、仓库状态聚合监控、多选批量 Git 操作（Pull/Push/Checkout/Merge/Commit）与实时彩色日志控制台。

**Architecture:** 前端采用 React 19 + TypeScript + Vite + TailwindCSS 构建响应式现代化交互界面；后端采用 Rust + Tauri 2.x 提供轻量跨平台桌面窗口、本地文件与 Git 命令行并发调用，通过 Tauri Commands 和 Events 双向通道与前端解耦通信；底层配置与 `mgit.yaml` 保持 100% 格式兼容。

**Tech Stack:** Rust (edition 2021), Tauri 2.x, React 19, TypeScript, Vite, TailwindCSS, Lucide Icons, Serde, Serde_yaml, Rayon / Tokio.

## Global Constraints

- 语言与环境：Rust 1.75+ (本地为 1.97.1)，Node.js 20+ (本地为 23.11.0)。
- 严禁代码中随意引入未在计划中说明的重型第三方依赖。
- 配置必须 100% 兼容现有 `mgit.yaml`（`modules` 映射结构）。
- 所有 Git 操作必须安全隔离并在指定的具体仓库目录内执行，采集标准输出与错误信息。
- 所有批量耗时操作不得阻塞主 UI 线程，通过 Tauri 事件通道实时流式推送日志。

---

### Task 1: 初始化 mgit-desktop 项目脚手架

**Files:**
- Create: `mgit-desktop/package.json`
- Create: `mgit-desktop/vite.config.ts`
- Create: `mgit-desktop/tsconfig.json`
- Create: `mgit-desktop/index.html`
- Create: `mgit-desktop/src-tauri/Cargo.toml`
- Create: `mgit-desktop/src-tauri/tauri.conf.json`
- Create: `mgit-desktop/src-tauri/src/main.rs`
- Create: `mgit-desktop/src-tauri/src/lib.rs`

**Interfaces:**
- Produces: 基础可运行的 Tauri 2.x + React + Vite 前后端工程骨架。

- [ ] **Step 1: 创建前端基础配置文件 (package.json, vite.config.ts, tsconfig.json, tailwindcss 配置)**
- [ ] **Step 2: 创建 Tauri 2.x 后端配置文件 (Cargo.toml, tauri.conf.json, capabilities)**
- [ ] **Step 3: 创建最小化的前端入口 index.html 与 src/main.tsx, src/App.tsx**
- [ ] **Step 4: 安装前端依赖并验证 `npm run build`**
- [ ] **Step 5: 验证 `cargo check` 通过**
- [ ] **Step 6: Git 提交脚手架代码**

---

### Task 2: Rust 核心数据模型与配置读写服务 (models.rs & config.rs)

**Files:**
- Create: `mgit-desktop/src-tauri/src/models.rs`
- Create: `mgit-desktop/src-tauri/src/config.rs`
- Test: `mgit-desktop/src-tauri/src/config.rs` (内嵌 unit test)

**Interfaces:**
- Produces:
  - `MgitConfig`: 包含 `modules: BTreeMap<String, Vec<String>>`
  - `load_config(path: &Path) -> Result<MgitConfig, String>`
  - `save_config(path: &Path, config: &MgitConfig) -> Result<(), String>`
  - `RepoStatus`: `{ name, path, relative_path, branch, dirty, ahead, behind, latest_commit }`
  - `GitOpResult`: `{ repo, success, message, raw_output, error }`
  - `LogEvent`: `{ timestamp, level, repo, message }`

- [ ] **Step 1: 编写 models.rs 定义数据结构**
- [ ] **Step 2: 编写 config.rs 的测试用例（测试读写 mgit.yaml）**
- [ ] **Step 3: 运行 cargo test 验证测试失败**
- [ ] **Step 4: 实现 config.rs（serde_yaml 读写与模块管理）**
- [ ] **Step 5: 运行 cargo test 验证通过**
- [ ] **Step 6: Git 提交配置服务**

---

### Task 3: 智能目录扫描器 (scanner.rs)

**Files:**
- Create: `mgit-desktop/src-tauri/src/scanner.rs`
- Test: `mgit-desktop/src-tauri/src/scanner.rs` (内嵌 unit test)

**Interfaces:**
- Produces:
  - `ScanSummary`: `{ total_repos: usize, total_modules: usize, modules: BTreeMap<String, Vec<String>> }`
  - `scan_directory(root_dir: &Path) -> Result<ScanSummary, String>`

- [ ] **Step 1: 编写 scanner_test 测试用例（构造包含 .git 目录的临时目录树，验证过滤 node_modules、target 及正规分组）**
- [ ] **Step 2: 运行测试验证失败**
- [ ] **Step 3: 实现 scanner.rs 递归遍历与路径归类逻辑**
- [ ] **Step 4: 运行 cargo test 验证通过**
- [ ] **Step 5: Git 提交扫描器**

---

### Task 4: Git 命令行执行器与并发操作引擎 (git/executor.rs & operations.rs)

**Files:**
- Create: `mgit-desktop/src-tauri/src/git/mod.rs`
- Create: `mgit-desktop/src-tauri/src/git/executor.rs`
- Create: `mgit-desktop/src-tauri/src/git/operations.rs`
- Test: `mgit-desktop/src-tauri/src/git/executor.rs`

**Interfaces:**
- Produces:
  - `GitExecutor::run_git(dir: &Path, args: &[&str]) -> Result<(i32, String, String), String>`
  - `GitExecutor::get_status(dir: &Path, root_dir: &Path) -> Result<RepoStatus, String>`
  - `batch_status(workspace: &Path, repos: &[String]) -> Vec<RepoStatus>`
  - `batch_pull<F>(workspace: &Path, repos: &[String], on_log: F) -> Vec<GitOpResult>`
  - `batch_push<F>(workspace: &Path, repos: &[String], on_log: F) -> Vec<GitOpResult>`
  - `batch_checkout<F>(workspace: &Path, repos: &[String], branch: &str, create: bool, base: Option<&str>, on_log: F) -> Vec<GitOpResult>`
  - `batch_merge<F>(workspace: &Path, repos: &[String], target: &str, on_log: F) -> Vec<GitOpResult>`
  - `batch_commit<F>(workspace: &Path, repos: &[String], message: &str, push: bool, on_log: F) -> Vec<GitOpResult>`

- [ ] **Step 1: 编写 GitExecutor 单元测试**
- [ ] **Step 2: 实现 executor.rs 命令封装（执行安全、输出捕获与状态解析）**
- [ ] **Step 3: 实现 operations.rs 并发调度与实时回调**
- [ ] **Step 4: 运行 cargo test 验证通过**
- [ ] **Step 5: Git 提交 Git 引擎**

---

### Task 5: Tauri Command 注册与后端生命周期集成 (lib.rs)

**Files:**
- Modify: `mgit-desktop/src-tauri/src/lib.rs`
- Modify: `mgit-desktop/src-tauri/src/main.rs`

**Interfaces:**
- Produces Tauri Commands:
  - `load_workspace_config(workspace: String)`
  - `save_workspace_config(workspace: String, config: MgitConfig)`
  - `scan_workspace(workspace: String)`
  - `get_repos_status(workspace: String, repos: Vec<String>)`
  - `git_pull(workspace: String, repos: Vec<String>)`
  - `git_push(workspace: String, repos: Vec<String>)`
  - `git_checkout(workspace: String, repos: Vec<String>, branch: String, create: bool, base: Option<String>)`
  - `git_merge(workspace: String, repos: Vec<String>, target: String)`
  - `git_commit(workspace: String, repos: Vec<String>, message: String, push: bool)`
  - `open_in_terminal(path: String)`
  - `open_in_finder(path: String)`

- [ ] **Step 1: 在 lib.rs 中定义所有的 Tauri Command 接口与参数映射**
- [ ] **Step 2: 绑定 AppHandle 事件推送 (`mgit://log`)**
- [ ] **Step 3: 运行 `cargo check` 确保所有 Commands 注册无误**
- [ ] **Step 4: Git 提交 Tauri Commands**

---

### Task 6: 前端基础类型、状态与 Tauri 适配 Hook (useMgit.ts, useTheme.ts)

**Files:**
- Create: `mgit-desktop/src/types/index.ts`
- Create: `mgit-desktop/src/hooks/useMgit.ts`
- Create: `mgit-desktop/src/hooks/useTheme.ts`

**Interfaces:**
- Produces:
  - 前端数据类型与事件定义
  - `useMgit`: 封装工作区切换、模块状态、仓库勾选、并发调用与实时日志监听
  - `useTheme`: 提供深色（dark）/ 浅色（light）/ 跟随系统主题状态

- [ ] **Step 1: 创建 types/index.ts 定义完备类型**
- [ ] **Step 2: 实现 useTheme.ts 支持 Tailwind 深浅色切换**
- [ ] **Step 3: 实现 useMgit.ts 封装与 Tauri 2.x 的 `invoke` 与 `listen`**
- [ ] **Step 4: 运行 `npm run build` 验证类型正确**
- [ ] **Step 5: Git 提交前端核心状态库**

---

### Task 7: 前端核心视图与布局组件构建 (Header, RepoTable, LogDrawer)

**Files:**
- Create: `mgit-desktop/src/components/Header.tsx`
- Create: `mgit-desktop/src/components/RepoTable.tsx`
- Create: `mgit-desktop/src/components/LogDrawer.tsx`
- Modify: `mgit-desktop/src/App.tsx`

**Interfaces:**
- Produces:
  - 现代化工作区头部控制栏（模块选择、一键操作触发按钮、主题切换）
  - 仓库状态列表（复选框、分支、修改状态标记、commit 信息、快捷操作）
  - 底部可伸缩彩色实时日志控制台

- [ ] **Step 1: 实现 Header.tsx 界面与动作绑定**
- [ ] **Step 2: 实现 RepoTable.tsx 状态表格展示与仓库多选/单选控制**
- [ ] **Step 3: 实现 LogDrawer.tsx 终端日志展示（带自动滚屏与清空）**
- [ ] **Step 4: 整合进 App.tsx 并测试响应式布局与深浅色模式**
- [ ] **Step 5: Git 提交核心视图组件**

---

### Task 8: 交互弹窗构建 (ScanModal, CheckoutModal, MergeModal, CommitModal, ModuleModal)

**Files:**
- Create: `mgit-desktop/src/components/modals/ScanModal.tsx`
- Create: `mgit-desktop/src/components/modals/CheckoutModal.tsx`
- Create: `mgit-desktop/src/components/modals/MergeModal.tsx`
- Create: `mgit-desktop/src/components/modals/CommitModal.tsx`
- Create: `mgit-desktop/src/components/modals/ModuleModal.tsx`
- Modify: `mgit-desktop/src/App.tsx`

**Interfaces:**
- Produces:
  - 目录智能扫描结果预览与写入弹窗
  - 批量分支切换与基于 base 分支新建弹窗
  - 批量分支合并弹窗
  - 批量 Commit 消息填写与 Push 选项弹窗
  - 模块增删改与仓库路径管理弹窗

- [ ] **Step 1: 实现 ScanModal.tsx**
- [ ] **Step 2: 实现 CheckoutModal.tsx 与 MergeModal.tsx**
- [ ] **Step 3: 实现 CommitModal.tsx**
- [ ] **Step 4: 实现 ModuleModal.tsx**
- [ ] **Step 5: 在 App.tsx 中集成所有弹窗状态流转**
- [ ] **Step 6: Git 提交弹窗组件**

---

### Task 9: 端到端集成验证与编译构建

**Files:**
- Review & Verify: `mgit-desktop/` 全体代码

- [ ] **Step 1: 运行完整前端生产构建 `npm run build`**
- [ ] **Step 2: 运行后端全部测试 `cargo test`**
- [ ] **Step 3: 运行 `cargo check` 确保 Release 配置正常**
- [ ] **Step 4: 验证应用对当前仓库 `mgit.yaml` 的加载、扫描与状态解析**
- [ ] **Step 5: 最终 Git 提交并产出 Walkthrough**
