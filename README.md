# mgit-desktop 🚀

<div align="center">

**专为多仓库（Multi-Repo）架构打造的现代化、极轻量、高性能跨平台桌面客户端**

[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8D8.svg?style=flat-square&logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)

[功能特性](#-核心特性) •
[快速开始](#-快速开始) •
[架构设计](#-架构与技术栈) •
[配置文件说明](#-配置文件-mgityaml) •
[构建发布](#-打包与构建)

</div>

---

## 📖 项目简介

在微服务、插件化或大型单仓多包开发场景中，开发者经常需要同时管理和协同数个甚至数十个 Git 代码仓库。传统单仓 Git 客户端或命令行工具在执行批量操作时往往费时费力、容易遗漏。

**mgit-desktop** 采用 **Rust + Tauri 2.x** 作为底层并发操作引擎，结合 **React 19 + TypeScript + TailwindCSS** 打造极致顺滑的现代化用户界面。与传统基于 Electron 的桌面客户端动辄上百兆相比，`mgit-desktop` 的 macOS 安装包**仅 2.8 MB**，启动如闪电，内存占用极低。

---

## ✨ 核心特性

- ⚡ **毫秒级并发状态监控**：基于 Rust `Rayon` 线程池，毫秒级并行抓取各子仓库所在分支、Clean/Dirty 修改标记、Ahead（领先）/ Behind（落后）提交数及最新 Commit 摘要。
- 🔍 **多仓库智能扫描与自动分组**：一键递归扫描工作区目录，自动过滤 `node_modules`、`target`、`.idea`、`build` 等无关目录，自动按一级子目录识别 Git 仓库并智能归类分组。
- 📦 **全套批量 Git 协同操作**：
  - **批量 Pull**：并发一键拉取指定模块或选中仓库的最新变更。
  - **批量 Push**：批量将本地已提交的代码推送到对应的 upstream 分支。
  - **批量 Checkout**：支持同时切换已有分支，或基于 Base 基准分支统一切出并新建分支（`-b`）。
  - **批量 Merge**：将指定分支安全合并到选中的所有仓库（`git merge --no-edit`）。
  - **批量 Commit**：为已修改的仓库统一提交更改，并支持提交后立即推送。
- 🖥️ **原生系统集成**：
  - 支持直接唤起操作系统原生（如 macOS Finder）文件夹选择对话框无缝切换工作区。
  - 单仓快捷操作：一键在系统默认终端中打开仓库路径，或在文件管理器中高亮定位。
- 📟 **实时流式终端日志**：底部内置可折叠展开的控制台抽屉，通过 Tauri 事件通道实时接收每条 Git 命令的执行细节与彩色状态徽标（Info、Success、Warn、Error），支持自动滚动与日志清空。
- 🎨 **现代化 UI 与双主题支持**：内建暗黑模式（Dark Mode）与明亮模式（Light Mode），支持仓库多选/全选/反选与即时模糊搜索过滤。

---

## 🏗 架构与技术栈

```
mgit-desktop/
├── src-tauri/                 # Rust 核心引擎
│   ├── Cargo.toml
│   ├── tauri.conf.json        # 桌面窗口配置 (1024x720 默认尺寸)
│   └── src/
│       ├── main.rs            # 桌面应用入口
│       ├── lib.rs             # Tauri Commands 注册与事件广播器
│       ├── models.rs          # 核心数据契约 (MgitConfig, RepoStatus, GitOpResult 等)
│       ├── config.rs          # mgit.yaml 解析、写入与测试
│       ├── scanner.rs         # 目录递归遍历与 Git 仓库智能归类器
│       └── git/
│           ├── executor.rs    # 单仓 Git 命令封装与安全执行
│           └── operations.rs  # Rayon 多线程并发批量操作调度器
└── src/                       # React 19 现代化前端
    ├── components/
    │   ├── Header.tsx         # 顶部工作区、模块切换、批量动作栏与主题开关
    │   ├── RepoTable.tsx      # 仓库列表、分支徽章、Clean/Dirty 状态、即时搜索
    │   ├── LogDrawer.tsx      # 底部可折叠实时控制台，语法着色与自动滚动
    │   └── modals/
    │       ├── ScanModal.tsx     # 智能目录扫描与分组预览写入弹窗
    │       ├── CheckoutModal.tsx # 批量检出与 (-b) 新建分支弹窗
    │       ├── MergeModal.tsx    # 批量分支合并弹窗
    │       ├── CommitModal.tsx   # 批量提交与立即推送弹窗
    │       └── ModuleModal.tsx   # 模块与关联仓库可视化管理弹窗
    ├── hooks/
    │   ├── useMgit.ts         # 核心响应式业务状态与 Tauri IPC 驱动
    │   └── useTheme.ts        # 深浅色主题与系统偏好联动
    └── types/index.ts         # TypeScript 数据契约
```

---

## ⚙️ 配置文件 (`mgit.yaml`)

`mgit-desktop` 深度兼容标准的 `mgit.yaml` 规范。在工作区根目录下存放 `mgit.yaml`，示例格式如下：

```yaml
modules:
  root:
    - ./
  services:
    - services/order-service
    - services/payment-service
    - services/user-service
  apps:
    - apps/web-portal
    - apps/mobile-app
```

> **提示**：您无需手动手写配置文件，直接在界面中点击 **`Scan`** 按钮扫描本地目录，应用会自动为您组织分组并一键生成或更新 `mgit.yaml`。

---

## 🚀 快速开始

### 准备环境
- **Node.js**：v20+ (推荐 v22+)
- **Rust**：1.75+ (已安装 `cargo` 与 `rustc`)
- **Git**：确保本地终端中 `git` 命令可用

### 1. 克隆仓库
```bash
git clone https://github.com/JoeCode-Space/mgit-desktop.git
cd mgit-desktop/mgit-desktop
```

### 2. 安装前端依赖
```bash
npm install
```

### 3. 运行开发模式（支持热重载）
```bash
npm run tauri dev
```
启动后将会自动弹出原生的 macOS/Windows/Linux 桌面应用窗口。

---

## 📦 打包与构建

如需打包生成最终用户可直接安装的 Release 二进制与安装镜像：

```bash
cd mgit-desktop
npm run tauri build
```

构建完成后，产物将生成在：
- **macOS DMG 镜像**：`src-tauri/target/release/bundle/dmg/mgit-desktop_0.1.0_aarch64.dmg`（仅 ~2.8MB）
- **macOS Application**：`src-tauri/target/release/bundle/macos/mgit-desktop.app`

---

## 🧪 自动化测试

项目后端包含完备的单元测试，覆盖配置序列化、仓库扫描剪枝、Git 状态解析与生命周期：

```bash
cd mgit-desktop/src-tauri
cargo test --lib
```

前端 TypeScript 类型与打包检查：
```bash
cd mgit-desktop
npm run build
```

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源发布。
