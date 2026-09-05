# 分支智能匹配与自定义输入功能设计规范 (Branch Autocomplete & Custom Input)

## 1. 概述与设计目标

在多仓库协同管理工具 `mgit-desktop` 中，用户进行“检出分支 (Checkout)”、“合并分支 (Merge)”等操作时，需要频繁输入分支名称（如目标分支、基准分支、待合入分支）。此前界面仅提供普通文本输入框，用户必须手动凭记忆逐字输入，不仅效率低下，而且极易因大小写拼写错误导致批量操作失败。

本功能旨在提供一套统一、高效且优雅的**分支快速匹配与自定义输入组件**：
1. **智能联想与匹配**：在输入框打字时，即时筛选并展示所选仓库的本地分支（Local）与远程分支（Remote）。
2. **完全支持自定义**：用户既可从下拉列表中一键选取，也可直接自由键入任意全新的自定义分支名。
3. **多仓库并集聚合**：在 Rust 侧多线程并行查询目标仓库的全部本地与远程分支，智能去重，为批量操作提供统一分支视图。
4. **键盘亲和与无缝集成**：支持上下键切换选中、Enter 快速回填、Esc 关闭；全面替换 `CheckoutModal` 与 `MergeModal` 中的原生输入框。

---

## 2. 系统架构与数据契约

### 2.1 数据模型契约

在 Rust 侧 (`models.rs`) 与 TypeScript 侧 (`types/index.ts`) 统一分支汇总结构：

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct BranchSummary {
    pub local: Vec<String>,
    pub remote: Vec<String>,
}
```

```typescript
export interface BranchSummary {
  local: string[];
  remote: string[];
}
```

- `local`：本地分支列表（如 `["main", "dev", "feature/auth"]`），按字母升序排序，常用基线分支（`main`、`master`、`dev`）优先前置。
- `remote`：远程分支列表（如 `["origin/main", "origin/dev", "upstream/main"]`），排除符号引用如 `origin/HEAD`。

---

## 3. 后端详细设计 (Rust / Tauri 2.x)

### 3.1 Git 单仓库分支提取 (`git/executor.rs`)

使用 Git 高效原生指令批量提取全部分支引用：
```bash
git for-each-ref --format="%(refname)" refs/heads refs/remotes
```
**解析策略**：
- 前缀为 `refs/heads/`：剥离前缀后计入本地分支（`local`）。
- 前缀为 `refs/remotes/`：剥离前缀后计入远程分支（`remote`）。若以 `/HEAD` 结尾（例如 `origin/HEAD`），则主动丢弃。
- 排序与去重：单仓库内部利用 `BTreeSet` 自动去重并保持字典序。

### 3.2 跨仓库多线程聚合 (`git/operations.rs`)

提供批量查询方法：
```rust
pub fn batch_get_branches(workspace: &Path, repos: &[String]) -> BranchSummary
```
- 利用 `rayon::par_iter()` 并行遍历各个仓库目录。
- 收集所有仓库的本地分支并集与远程分支并集（使用全局 `BTreeSet<String>` 进行合并去重）。
- 若某个仓库路径不存在或非 Git 仓库，自动安全忽略，不阻塞其他仓库的分支提取。

### 3.3 Tauri Command 路由 (`lib.rs`)

暴露给前端调用的 Tauri Command：
```rust
#[command]
fn get_workspace_branches(workspace: String, repos: Vec<String>) -> Result<BranchSummary, String>
```
并在 `generate_handler!` 宏中完成注册。

---

## 4. 前端通用组件设计 (`BranchCombobox.tsx`)

### 4.1 组件接口定义

文件路径：`src/components/common/BranchCombobox.tsx`

```typescript
export interface BranchComboboxProps {
  value: string;
  onChange: (value: string) => void;
  repos: string[];
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  required?: boolean;
  className?: string;
  icon?: React.ReactNode;
}
```

### 4.2 交互与键盘行为规范

1. **常态与输入状态**：
   - 输入框作为主要交互载体，用户可随时直接打字、修改、粘贴任意自定义分支名称。
   - 输入内容与外部表单受控绑定 (`value` / `onChange`)。
2. **下拉面板触发逻辑**：
   - 输入框聚焦 (`onFocus`) 或有输入内容变更时，展开下拉面板。
   - 点击外部区域或按 `Esc` 键时，自动关闭下拉面板。
3. **联想与匹配规则**：
   - 忽略大小写的不区分大小写模糊子串匹配（Case-insensitive substring match）。
   - 分组展示：
     - **本地分支 (Local Branches)**：带有 `GitBranch` 绿色/靛色图标。
     - **远程分支 (Remote Branches)**：带有 `Cloud` 或 `GitFork` 浅蓝色图标。
   - 当用户输入的字符串不在已有列表中时，在下拉框底部呈现条目：
     - `使用自定义分支: "{query}"`
4. **键盘导航**：
   - `ArrowDown` / `ArrowUp`：在可见的候选条目之间移动高亮项（支持自动滚动）。
   - `Enter`：
     - 若当前有条目被高亮，则填入该条目的分支名并关闭面板，阻止表单默认提交；
     - 若无高亮项，直接采用当前输入框文本并触发正常表单提交。
   - `Escape`：直接关闭下拉列表。

---

## 5. 页面与模态框集成

### 5.1 `CheckoutModal.tsx`
- **目标分支 (Target Branch)**：替换为 `<BranchCombobox />`，传入当前所选仓库 `targetReposList.map(r => r.relative_path)`。
- **基于分支 (Base Branch)**（创建新分支勾选时展示）：替换为 `<BranchCombobox />`，placeholder 设为 `"留空则基于当前 HEAD 分支"`。

### 5.2 `MergeModal.tsx`
- **待合并分支 (Branch to merge)**：替换为 `<BranchCombobox />`，placeholder 设为 `"例如: origin/main 或 dev"`。

### 5.3 浏览器与开发环境兼容 (Mock Support)
- 在 `useMgit.ts` 中扩展 `getBranches(repos: string[])` 方法。
- 若运行于纯浏览器或非 Tauri 环境，提供内置 Mock 分支数据（`["main", "dev", "feature/v1.0", "origin/main", "origin/dev"]`），保证本地热更新开发和测试不受影响。

---

## 6. 测试与验证策略

1. **Rust 单元测试 (`git/executor.rs` & `git/operations.rs`)**：
   - 在临时目录初始化含本地与远程分支的 Git 仓库，断言 `get_repo_branches` 正确解析。
   - 测试包含无效/不存在目录时的容错机制。
   - 测试 `batch_get_branches` 的多仓库并集去重正确性。
2. **前端交互与端到端验证**：
   - 验证 `CheckoutModal` 和 `MergeModal` 的下拉联想、高亮选择与键盘回车行为。
   - 验证输入任意自定义分支名（如 `feature/my-custom-test`）时，能顺利提交并执行新建/检出/合并操作。
