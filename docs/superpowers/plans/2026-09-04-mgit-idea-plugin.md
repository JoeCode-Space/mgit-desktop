# mgit IntelliJ IDEA Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一款用于 IntelliJ IDEA 的多仓库管理插件 `mgit`，支持基于 `mgit.yaml` 的模块分组、仓库状态监控与批量 Git 操作（Pull、Push、Checkout、Merge、Commit），并提供仓库扫描和实时日志控制台。

**Architecture:** 插件工程位于 `mgit-idea-plugin` 子目录，采用 Gradle + IntelliJ Platform Gradle Plugin 构建。由配置与扫描层（SnakeYAML 驱动）、Git 命令行并发执行层（后台线程池 + ProcessBuilder 异步回调）和基于 Swing/IntelliJ OpenAPI 的 ToolWindow UI 交互层（JBTable + ConsolePanel + Dialogs）三层组成。

**Tech Stack:** Java 17, Gradle 8.x, IntelliJ Platform SDK (org.jetbrains.intellij.platform), SnakeYAML, JUnit 5.

## Global Constraints

- 严禁使用全类名（No-FQCN）：所有 Java 文件必须在文件头部通过 `import` 引入类库，代码中使用简写类名。
- 语言基线为 Java 17，构建工具使用 Gradle。
- 所有 Git 命令行调用必须在后台线程池执行，UI 更新必须通过 `ApplicationManager.getApplication().invokeLater(...)` 调度至 EDT。
- 配置兼容并复用 `mgit.yaml`，路径统一采用规范化相对/绝对路径管理。

---

### Task 1: 项目脚手架与 Gradle 配置

**Files:**
- Create: `mgit-idea-plugin/settings.gradle.kts`
- Create: `mgit-idea-plugin/build.gradle.kts`
- Create: `mgit-idea-plugin/src/main/resources/META-INF/plugin.xml`
- Create: `mgit-idea-plugin/gradle/wrapper/gradle-wrapper.properties`

**Interfaces:**
- Produces: 基础插件工程骨架与依赖配置，支持 `./gradlew buildPlugin`。

- [ ] **Step 1: 创建 settings.gradle.kts**
- [ ] **Step 2: 创建 build.gradle.kts 配置 IntelliJ Platform 插件与 SnakeYAML、JUnit 5 依赖**
- [ ] **Step 3: 创建基础 plugin.xml 清单文件**
- [ ] **Step 4: 初始化 Gradle Wrapper 并运行测试验证构建**
- [ ] **Step 5: Git 提交基础脚手架**

---

### Task 2: 配置模型与 MgitConfigService 实现

**Files:**
- Create: `mgit-idea-plugin/src/main/java/com/mgit/plugin/config/MgitConfig.java`
- Create: `mgit-idea-plugin/src/main/java/com/mgit/plugin/config/MgitConfigService.java`
- Test: `mgit-idea-plugin/src/test/java/com/mgit/plugin/config/MgitConfigServiceTest.java`

**Interfaces:**
- Produces:
  - `MgitConfig`: `Map<String, List<String>> getModules()`, `void setModules(Map<String, List<String>> modules)`
  - `MgitConfigService`: `MgitConfig loadConfig(Path projectRoot)`, `void saveConfig(Path projectRoot, MgitConfig config)`

- [ ] **Step 1: 编写 MgitConfigServiceTest 测试用例（测试读写 mgit.yaml）**
- [ ] **Step 2: 运行测试并确认失败**
- [ ] **Step 3: 实现 MgitConfig 与 MgitConfigService（使用 SnakeYAML）**
- [ ] **Step 4: 运行测试确认通过**
- [ ] **Step 5: Git 提交配置服务**

---

### Task 3: 目录递归扫描与自动分组 (RepoScanner)

**Files:**
- Create: `mgit-idea-plugin/src/main/java/com/mgit/plugin/config/RepoScanner.java`
- Test: `mgit-idea-plugin/src/test/java/com/mgit/plugin/config/RepoScannerTest.java`

**Interfaces:**
- Consumes: `MgitConfig` from Task 2
- Produces: `RepoScanner.ScanResult scan(Path rootDir)`，按第一级子目录将包含 `.git` 的仓库分组，返回模块数与仓库总数。

- [ ] **Step 1: 编写 RepoScannerTest 单元测试（在临时目录构造多仓库目录树）**
- [ ] **Step 2: 运行测试并确认失败**
- [ ] **Step 3: 实现 RepoScanner（文件树遍历、忽略列表过滤、自动分组归类）**
- [ ] **Step 4: 运行测试确认通过**
- [ ] **Step 5: Git 提交 RepoScanner**

---

### Task 4: Git 命令行执行器 (GitCliExecutor)

**Files:**
- Create: `mgit-idea-plugin/src/main/java/com/mgit/plugin/core/GitOperationResult.java`
- Create: `mgit-idea-plugin/src/main/java/com/mgit/plugin/git/GitCliExecutor.java`
- Test: `mgit-idea-plugin/src/test/java/com/mgit/plugin/git/GitCliExecutorTest.java`

**Interfaces:**
- Produces:
  - `GitOperationResult(int exitCode, String stdout, String stderr)`
  - `GitCliExecutor`:
    - `GitOperationResult execute(File workingDir, String... args)`
    - `String getBranch(File repoDir)`
    - `boolean isDirty(File repoDir)`
    - `GitOperationResult pull(File repoDir)`
    - `GitOperationResult push(File repoDir)`
    - `GitOperationResult checkout(File repoDir, String branch, boolean createBranch, String baseBranch)`
    - `GitOperationResult merge(File repoDir, String targetBranch)`
    - `GitOperationResult commit(File repoDir, String message)`

- [ ] **Step 1: 编写 GitCliExecutorTest 测试（针对实际 git 命令的调用解析）**
- [ ] **Step 2: 运行测试确认失败**
- [ ] **Step 3: 实现 GitOperationResult 与 GitCliExecutor（ProcessBuilder 封装）**
- [ ] **Step 4: 运行测试确认通过**
- [ ] **Step 5: Git 提交 GitCliExecutor**

---

### Task 5: 异步并发服务与核心管理器 (GitAsyncService & MgitManager)

**Files:**
- Create: `mgit-idea-plugin/src/main/java/com/mgit/plugin/core/RepoStatus.java`
- Create: `mgit-idea-plugin/src/main/java/com/mgit/plugin/git/GitAsyncService.java`
- Create: `mgit-idea-plugin/src/main/java/com/mgit/plugin/core/MgitManager.java`
- Test: `mgit-idea-plugin/src/test/java/com/mgit/plugin/git/GitAsyncServiceTest.java`

**Interfaces:**
- Consumes: `GitCliExecutor` from Task 4, `MgitConfigService` from Task 2
- Produces:
  - `GitAsyncService`: 线程池管理，批量并发执行并支持日志消费者回调 `Consumer<String>`。
  - `MgitManager`: 统一管理状态缓存、当前模块、项目根路径与生命周期。

- [ ] **Step 1: 编写并发执行与回调测试用例**
- [ ] **Step 2: 运行测试确认失败**
- [ ] **Step 3: 实现 RepoStatus、GitAsyncService 与 MgitManager**
- [ ] **Step 4: 运行测试确认通过**
- [ ] **Step 5: Git 提交并发调度层**

---

### Task 6: UI 组件与操作对话框

**Files:**
- Create: `mgit-idea-plugin/src/main/java/com/mgit/plugin/ui/RepoTableModel.java`
- Create: `mgit-idea-plugin/src/main/java/com/mgit/plugin/ui/ConsolePanel.java`
- Create: `mgit-idea-plugin/src/main/java/com/mgit/plugin/ui/dialog/CheckoutDialog.java`
- Create: `mgit-idea-plugin/src/main/java/com/mgit/plugin/ui/dialog/MergeDialog.java`
- Create: `mgit-idea-plugin/src/main/java/com/mgit/plugin/ui/dialog/CommitDialog.java`

**Interfaces:**
- Consumes: `RepoStatus`, `MgitManager`
- Produces:
  - `RepoTableModel`: `JBTable` 数据模型，包含仓库名、分支、状态（Clean/Dirty）、消息列。
  - `ConsolePanel`: 带时间戳、彩色文字与自动滚屏的日志输出控制台。
  - 弹出式交互对话框（分支切换、合并、提交）。

- [ ] **Step 1: 编写 RepoTableModel 单元测试验证列定义与状态渲染数据**
- [ ] **Step 2: 实现 RepoTableModel 与单元测试验证**
- [ ] **Step 3: 实现 ConsolePanel 日志控制台**
- [ ] **Step 4: 实现 CheckoutDialog、MergeDialog、CommitDialog 交互对话框**
- [ ] **Step 5: Git 提交 UI 组件**

---

### Task 7: 组装 MgitMainPanel 与注册 ToolWindow

**Files:**
- Create: `mgit-idea-plugin/src/main/java/com/mgit/plugin/ui/MgitMainPanel.java`
- Create: `mgit-idea-plugin/src/main/java/com/mgit/plugin/ui/MgitToolWindowFactory.java`
- Modify: `mgit-idea-plugin/src/main/resources/META-INF/plugin.xml`

**Interfaces:**
- Consumes: All components from Tasks 1-6
- Produces: 完整的 ToolWindow 呈现，绑定所有按钮事件（Refresh、Pull、Push、Checkout、Merge、Commit、Scan）。

- [ ] **Step 1: 实现 MgitMainPanel 顶部工具栏、表格与控制台组装及事件监听**
- [ ] **Step 2: 实现 MgitToolWindowFactory 并接入 IntelliJ ToolWindow**
- [ ] **Step 3: 在 plugin.xml 注册 toolWindow 扩展点**
- [ ] **Step 4: 编译并验证无语法与装配错误**
- [ ] **Step 5: Git 提交 ToolWindow 组装**

---

### Task 8: 全量构建与端到端插件打包验证

**Files:**
- Modify: `README.md` (说明插件使用与编译方法)

- [ ] **Step 1: 运行全量单元测试 `./gradlew test` 确保所有测试绿灯**
- [ ] **Step 2: 运行 `./gradlew buildPlugin` 生成插件 zip 包并验证产物**
- [ ] **Step 3: 编写 README.md 补充插件使用指南**
- [ ] **Step 4: Git 提交完整项目产物**
