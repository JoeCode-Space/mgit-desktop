# mgit IntelliJ IDEA 插件设计文档

## 1. 概述与目标

为多仓库（Multi-Repo）协作项目提供一款 IntelliJ IDEA 原生插件 `mgit`。该插件兼容并继承现有 Go/Fyne 版本 `mgit` 的 `mgit.yaml` 规范，在 IDEA 内提供专有的常驻 ToolWindow 面板，支持多仓库的集中分组查看、状态监控与批量 Git 协作操作（Pull、Push、Checkout、Merge、Commit），并支持工程内 Git 仓库的自动扫描与分组生成。

## 2. 技术选型与设计规范

* **开发语言**：Java 17（与现代 IntelliJ Platform 基线一致）。
* **代码风格**：严格遵循无全类名（No-FQCN）规范，所有外部类库在文件头部通过 `import` 引入，代码内部使用简写。
* **构建系统**：Gradle + IntelliJ Platform Gradle Plugin 2.x。
* **依赖库**：
  * `org.yaml.snakeyaml:snakeyaml`：用于 `mgit.yaml` 的解析与格式化写入。
  * `com.intellij.openapi`：IntelliJ Platform OpenAPI（ToolWindow、ProjectService、Notification 等）。
* **Git 调用机制**：基于本地 `git` 命令行进程调用，通过后台并发线程池异步执行，UI 线程异步响应。

## 3. 架构与包结构

```
mgit-idea-plugin/
├── build.gradle.kts
├── settings.gradle.kts
└── src/
    └── main/
        ├── java/
        │   └── com/
        │       └── mgit/
        │           └── plugin/
        │               ├── config/        // 配置读取与仓库扫描
        │               │   ├── MgitConfig.java
        │               │   ├── MgitConfigService.java
        │               │   └── RepoScanner.java
        │               ├── core/          // 数据模型与统一管理器
        │               │   ├── RepoStatus.java
        │               │   ├── GitOperationResult.java
        │               │   └── MgitManager.java
        │               ├── git/           // Git 命令行封装与并发服务
        │               │   ├── GitCliExecutor.java
        │               │   └── GitAsyncService.java
        │               └── ui/            // ToolWindow 与界面组件
        │                   ├── MgitToolWindowFactory.java
        │                   ├── MgitMainPanel.java
        │                   ├── RepoTableModel.java
        │                   ├── ConsolePanel.java
        │                   └── dialog/
        │                       ├── CheckoutDialog.java
        │                       ├── MergeDialog.java
        │                       └── CommitDialog.java
        └── resources/
            └── META-INF/
                ├── plugin.xml
                └── pluginIcon.svg
```

## 4. 核心组件与业务流程

### 4.1 配置与扫描 (Config & Scan)

* **`mgit.yaml` 格式定义**：
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
* **`MgitConfigService`**：负责定位项目根目录下的 `mgit.yaml`，读取并解析为 `MgitConfig`；支持将内存中的模块配置覆写回文件。
* **`RepoScanner`**：
  * 从当前 Project 根路径递归遍历。
  * 忽略目录：`.idea`、`.git`、`node_modules`、`target`、`build`、`.gradle`。
  * 规则：命中含有 `.git` 的子目录即确认为独立仓库，依据相对项目根目录的第一级目录名作为 module 名称，项目根目录自身归为 `root` 模块。
  * 扫描完成后生成并覆盖更新 `mgit.yaml`。

### 4.2 Git 执行器与并发服务 (Git Engine)

* **`GitCliExecutor`**：
  * 使用 `ProcessBuilder` 执行本地命令，注入工作目录（`workingDir`）。
  * 采集标准输出与标准错误流，返回包含 `exitCode`、`stdout`、`stderr` 的 `GitOperationResult`。
  * 核心指令映射：
    * 状态获取：`git rev-parse --abbrev-ref HEAD`、`git status --porcelain`
    * 批量 Pull：`git pull --no-edit`
    * 批量 Push：`git push`
    * 批量 Checkout：`git checkout <branch>` 或 `git checkout -b <branch> [baseBranch]`
    * 批量 Merge：`git merge --no-edit <targetBranch>`
    * 批量 Commit：`git commit -am "<message>"`
* **`GitAsyncService`**：
  * 管理内部线程池 `ExecutorService`（固定线程数，如 8）。
  * 批量操作时为每个子仓库提交任务，使用 `CompletableFuture` 收集全部结果。
  * 关键交互解耦：每个仓库的即时标准输出/错误通过事件回调，在 `ApplicationManager.getApplication().invokeLater(...)` 中切回 EDT 刷新日志窗口与表格行状态，确保 UI 丝滑响应。

### 4.3 UI 交互界面 (ToolWindow UI)

* **`MgitToolWindowFactory`**：在 IDEA 底部注册 id 为 `mgit` 的工具窗口，初始化 `MgitMainPanel`。
* **`MgitMainPanel`**：
  * **顶部 Toolbar**：
    * Module 切换下拉菜单（`JComboBox<String>`）
    * 刷新按钮（Refresh）
    * 拉取按钮（Pull）
    * 推送按钮（Push，带防误触确认）
    * 分支操作（Checkout，弹窗支持新建与基线分支）
    * 合并操作（Merge，弹窗输入来源分支）
    * 提交操作（Commit，弹窗输入 Commit 备注）
    * 扫描重载（Scan & Reload）
  * **中部表格（`JBTable`）**：
    * 列：仓库名称/相对路径（Repository）、当前分支（Branch）、改动状态（Status: ✅ Clean / ⚠️ Dirty）、操作信息（Message）。
    * 双击行可在 IDEA 项目树中展开定位该子仓库。
  * **底部日志区（`ConsolePanel`）**：
    * 文本日志控制台，带时间戳，高亮成功（绿色）、失败（红色）。
    * 工具按钮：清空（Clear）、自动滚屏（Auto-Scroll）。

## 5. 错误处理与容错

1. **Git 依赖缺失**：启动或执行前检测 `git` 命令可用性，若系统中未安装或找不到环境变量，控制台与通知栏给予安装配置提示。
2. **多仓库单点失败隔离**：任一仓库拉取冲突、合并冲突或推送失败时，捕获异常并高亮该仓库日志，不阻塞、不影响其余仓库的继续执行。
3. **配置文件缺失**：项目根目录下无 `mgit.yaml` 时，自动显示空状态引导视图，提示用户“点击扫描以自动生成配置”。

## 6. 验证方案

1. **自动化构建与单元测试**：
   * Gradle 单元测试：验证 `MgitConfigService` 读写 YAML 的兼容性。
   * 验证 `RepoScanner` 在模拟目录树下的分组正确性。
2. **插件构建与运行验证**：
   * 运行 `./gradlew buildPlugin` 生成插件发布包（`.zip`）。
   * 运行 `./gradlew runIde` 启动沙箱 IDEA 实例，在沙箱工程中验证 ToolWindow 加载、多仓库扫描、状态刷新与批量 Git 操作。
