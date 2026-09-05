# 分支快速匹配与自定义输入功能实施计划 (Branch Autocomplete Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `mgit-desktop` 桌面端中，为检出分支（Checkout）与合并分支（Merge）等操作提供基于所选仓库的智能分支匹配（Local/Remote 分类联想）与完全自定义输入的通用 Combobox 功能。

**Architecture:** 后端利用 Rust + Rayon 多线程并发向所选 Git 仓库执行 `git for-each-ref` 提取本地与远程分支并去重，暴露 Tauri 指令 `get_workspace_branches`；前端基于 React + Tailwind 构建通用的 `<BranchCombobox />` 组件，无缝替换 `CheckoutModal` 和 `MergeModal` 中的原生输入框。

**Tech Stack:** Rust (Tauri 2.x, Rayon, Serde), React 19, TypeScript, TailwindCSS, Lucide Icons.

## Global Constraints

- 不使用全类名（遵守 `no_fqcn.md` 规则）。
- 所有对话与注释使用中文。
- 保证无网络/离线及非 Tauri 开发环境下的兼容（Mock 数据回退）。
- 严格遵循 TDD 流程，新增后端逻辑编写独立单元测试。

---

### Task 1: Rust 后端 - 分支数据结构与单仓库分支提取

**Files:**
- Modify: `mgit-desktop/src-tauri/src/models.rs`
- Modify: `mgit-desktop/src-tauri/src/git/executor.rs`

**Interfaces:**
- Produces: `BranchSummary { pub local: Vec<String>, pub remote: Vec<String> }`
- Produces: `get_repo_branches(repo_dir: &Path) -> Result<BranchSummary, String>`

- [ ] **Step 1: 编写单仓库分支提取的失败测试**

在 `mgit-desktop/src-tauri/src/git/executor.rs` 的 `mod tests` 中增加测试用例：
```rust
#[test]
fn test_get_repo_branches() {
    let temp = TempDirGuard::new("mgit_branches_test");
    let repo_path = temp.path();
    init_test_repo(repo_path);

    // Initial commit
    let file_path = repo_path.join("file.txt");
    write(&file_path, "test").unwrap();
    let _ = git_commit(repo_path, "commit 1", false);

    // Create a local branch
    let _ = git_checkout(repo_path, "feature/login", true, None);

    let branches = get_repo_branches(repo_path).expect("get_repo_branches should succeed");
    assert!(branches.local.contains(&"feature/login".to_string()));
    assert!(branches.local.contains(&"main".to_string()) || branches.local.contains(&"master".to_string()));
}
```

- [ ] **Step 2: 运行测试并验证失败**

在 `mgit-desktop/src-tauri` 下执行：
```bash
cargo test test_get_repo_branches
```
预期结果：编译失败（`cannot find function get_repo_branches in this scope`）。

- [ ] **Step 3: 定义数据结构与实现单仓库提取逻辑**

在 `mgit-desktop/src-tauri/src/models.rs` 中定义 `BranchSummary`：
```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct BranchSummary {
    pub local: Vec<String>,
    pub remote: Vec<String>,
}
```

在 `mgit-desktop/src-tauri/src/git/executor.rs` 中实现 `get_repo_branches`：
```rust
use std::collections::BTreeSet;
use crate::models::BranchSummary;

pub fn get_repo_branches(repo_dir: &Path) -> Result<BranchSummary, String> {
    if !repo_dir.exists() {
        return Err(format!("Repository directory does not exist: '{}'", repo_dir.display()));
    }

    let (code, stdout, stderr) = run_git(
        repo_dir,
        &["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"],
    )?;

    if code != 0 {
        return Err(format!("git for-each-ref failed: {}", stderr.trim()));
    }

    let mut local_set = BTreeSet::new();
    let mut remote_set = BTreeSet::new();

    for line in stdout.lines() {
        let refname = line.trim();
        if let Some(branch) = refname.strip_prefix("refs/heads/") {
            if !branch.is_empty() {
                local_set.insert(branch.to_string());
            }
        } else if let Some(branch) = refname.strip_prefix("refs/remotes/") {
            // Ignore /HEAD symbolic refs
            if !branch.ends_with("/HEAD") && !branch.is_empty() {
                remote_set.insert(branch.to_string());
            }
        }
    }

    Ok(BranchSummary {
        local: local_set.into_iter().collect(),
        remote: remote_set.into_iter().collect(),
    })
}
```

- [ ] **Step 4: 运行单元测试验证通过**

```bash
cargo test test_get_repo_branches
```
预期结果：PASS。

- [ ] **Step 5: 提交更改**

```bash
git add mgit-desktop/src-tauri/src/models.rs mgit-desktop/src-tauri/src/git/executor.rs
git commit -m "feat(backend): implement single-repo branch extraction"
```

---

### Task 2: Rust 后端 - 多仓库并行聚合与 Tauri 指令暴露

**Files:**
- Modify: `mgit-desktop/src-tauri/src/git/operations.rs`
- Modify: `mgit-desktop/src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `get_repo_branches` from `git::executor`
- Produces: `batch_get_branches(workspace: &Path, repos: &[String]) -> BranchSummary`
- Produces Tauri command: `get_workspace_branches(workspace: String, repos: Vec<String>) -> Result<BranchSummary, String>`

- [ ] **Step 1: 编写多仓库并行聚合与命令的失败测试**

在 `mgit-desktop/src-tauri/src/git/operations.rs` 中增加测试：
```rust
#[test]
fn test_batch_get_branches() {
    let temp = TempDirGuard::new("mgit_batch_branches_test");
    let ws = temp.path();

    let r1 = ws.join("repo-1");
    let r2 = ws.join("repo-2");
    std::fs::create_dir_all(&r1).unwrap();
    std::fs::create_dir_all(&r2).unwrap();
    init_repo_with_commit(&r1, "a.txt");
    init_repo_with_commit(&r2, "b.txt");

    let _ = git_checkout(&r1, "feat/branch-1", true, None);
    let _ = git_checkout(&r2, "feat/branch-2", true, None);

    let repos = vec!["repo-1".to_string(), "repo-2".to_string()];
    let summary = batch_get_branches(ws, &repos);

    assert!(summary.local.contains(&"feat/branch-1".to_string()));
    assert!(summary.local.contains(&"feat/branch-2".to_string()));
}
```

- [ ] **Step 2: 运行测试并验证失败**

```bash
cargo test test_batch_get_branches
```
预期结果：编译失败（`cannot find function batch_get_branches in this scope`）。

- [ ] **Step 3: 实现 `batch_get_branches` 与 Tauri Command**

在 `mgit-desktop/src-tauri/src/git/operations.rs` 中：
```rust
use std::collections::BTreeSet;
use crate::git::executor::get_repo_branches;
use crate::models::BranchSummary;

pub fn batch_get_branches(workspace: &Path, repos: &[String]) -> BranchSummary {
    let results: Vec<BranchSummary> = repos
        .par_iter()
        .filter_map(|repo| {
            let repo_dir = resolve_repo_dir(workspace, repo);
            get_repo_branches(&repo_dir).ok()
        })
        .collect();

    let mut local_set = BTreeSet::new();
    let mut remote_set = BTreeSet::new();

    for summary in results {
        for l in summary.local {
            local_set.insert(l);
        }
        for r in summary.remote {
            remote_set.insert(r);
        }
    }

    BranchSummary {
        local: local_set.into_iter().collect(),
        remote: remote_set.into_iter().collect(),
    }
}
```

在 `mgit-desktop/src-tauri/src/lib.rs` 中引入并暴露命令：
```rust
use crate::git::operations::{
    batch_checkout, batch_commit, batch_get_branches, batch_merge, batch_pull, batch_push,
    batch_status,
};
use crate::models::{BranchSummary, GitOpResult, MgitConfig, RepoStatus, ScanSummary};

/// Retrieve aggregated local and remote branch list across multiple repositories.
#[command]
fn get_workspace_branches(
    workspace: String,
    repos: Vec<String>,
) -> Result<BranchSummary, String> {
    Ok(batch_get_branches(Path::new(&workspace), &repos))
}
```
并在 `generate_handler!` 宏中添加 `get_workspace_branches`。

- [ ] **Step 4: 运行所有 Rust 测试**

```bash
cargo test
```
预期结果：所有测试顺利 PASS。

- [ ] **Step 5: 提交更改**

```bash
git add mgit-desktop/src-tauri/src/git/operations.rs mgit-desktop/src-tauri/src/lib.rs
git commit -m "feat(backend): add batch_get_branches and get_workspace_branches command"
```

---

### Task 3: 前端数据类型与 `useMgit` Hook 集成

**Files:**
- Modify: `mgit-desktop/src/types/index.ts`
- Modify: `mgit-desktop/src/hooks/useMgit.ts`

**Interfaces:**
- Produces: `BranchSummary` in TypeScript
- Produces: `getBranches: (repos?: string[]) => Promise<BranchSummary>` in `UseMgitReturn`

- [ ] **Step 1: 在 `types/index.ts` 中定义类型与方法签名**

在 `mgit-desktop/src/types/index.ts` 中：
```typescript
export interface BranchSummary {
  local: string[];
  remote: string[];
}

export interface UseMgitReturn {
  // ... 现有字段
  getBranches: (repos?: string[]) => Promise<BranchSummary>;
}
```

- [ ] **Step 2: 在 `useMgit.ts` 中实现 `getBranches`**

```typescript
const MOCK_BRANCHES: BranchSummary = {
  local: ['main', 'master', 'dev', 'test', 'feature/login', 'release/v1.0'],
  remote: ['origin/main', 'origin/master', 'origin/dev', 'origin/feature/login'],
};

const getBranches = useCallback(
  async (targetRepos?: string[]): Promise<BranchSummary> => {
    const ws = workspaceRef.current;
    const cfg = configRef.current;
    const mod = currentModuleRef.current;

    const reposToQuery =
      targetRepos && targetRepos.length > 0
        ? targetRepos
        : cfg?.modules[mod] || reposRef.current.map((r) => r.relative_path);

    if (reposToQuery.length === 0) {
      return { local: [], remote: [] };
    }

    if (isTauri()) {
      try {
        return await invoke<BranchSummary>('get_workspace_branches', {
          workspace: ws,
          repos: reposToQuery,
        });
      } catch (err) {
        console.error('Failed to get branches:', err);
        return { local: [], remote: [] };
      }
    } else {
      return MOCK_BRANCHES;
    }
  },
  []
);
```
并在 `useMgit` 返回值中导出 `getBranches`。

- [ ] **Step 3: 验证前端类型无编译报错**

在 `mgit-desktop` 目录下运行：
```bash
npm run build
```
预期结果：编译通过。

- [ ] **Step 4: 提交更改**

```bash
git add mgit-desktop/src/types/index.ts mgit-desktop/src/hooks/useMgit.ts
git commit -m "feat(frontend): expose getBranches in useMgit hook"
```

---

### Task 4: 构建通用 `BranchCombobox` UI 组件

**Files:**
- Create: `mgit-desktop/src/components/common/BranchCombobox.tsx`

**Interfaces:**
- Produces: `<BranchCombobox />` React 组件，受控支持 `value`, `onChange`, `repos`, 键盘上下键切换、回车选中、Esc 取消、分类显示 Local 与 Remote、并提供使用自定义名称选项。

- [ ] **Step 1: 编写 `BranchCombobox.tsx`**

实现包含以下特性的组件：
1. 使用 `useMgit` 或传入的 `getBranches` 自动拉取所选 `repos` 的分支列表。
2. 内部维护 `isOpen`, `highlightIndex`, `query` 状态。
3. 对 `local` 与 `remote` 分支按输入内容做模糊搜索。
4. 渲染分组列表：
   - 📌 本地分支 (Local)
   - 🌐 远程分支 (Remote)
   - ➕ 使用自定义分支 (若当前 query 存在且非已有分支完全匹配)
5. 监听键盘 `ArrowDown`, `ArrowUp`, `Enter`, `Escape` 事件。
6. 点击外部区域自动收起。

- [ ] **Step 2: 验证组件类型与打包**

在 `mgit-desktop` 目录下执行：
```bash
npm run build
```
预期结果：无 TypeScript 报错，编译构建成功。

- [ ] **Step 3: 提交更改**

```bash
git add mgit-desktop/src/components/common/BranchCombobox.tsx
git commit -m "feat(frontend): create universal BranchCombobox component"
```

---

### Task 5: 模态框接入与端到端功能验证

**Files:**
- Modify: `mgit-desktop/src/components/modals/CheckoutModal.tsx`
- Modify: `mgit-desktop/src/components/modals/MergeModal.tsx`
- Modify: `mgit-desktop/src/App.tsx` (如有需要传递 `getBranches` 或直接在组件中使用)

- [ ] **Step 1: 在 `CheckoutModal.tsx` 中接入 `BranchCombobox`**

- 将目标分支 `targetBranch` 的原生 `<input>` 替换为 `<BranchCombobox value={targetBranch} onChange={setTargetBranch} repos={targetRepoPaths} ... />`。
- 将创建分支时的基于分支 `baseBranch` 替换为 `<BranchCombobox value={baseBranch} onChange={setBaseBranch} repos={targetRepoPaths} ... />`。

- [ ] **Step 2: 在 `MergeModal.tsx` 中接入 `BranchCombobox`**

- 将待合并分支 `branchToMerge` 的原生 `<input>` 替换为 `<BranchCombobox value={branchToMerge} onChange={setBranchToMerge} repos={targetRepoPaths} ... />`。

- [ ] **Step 3: 运行完整自动化构建与测试**

```bash
cd mgit-desktop
npm run build
cd src-tauri
cargo test
```
预期结果：前端 build 与后端全部测试均成功通过。

- [ ] **Step 4: 提交并推送到代码库**

```bash
git add mgit-desktop/src/components/modals/CheckoutModal.tsx mgit-desktop/src/components/modals/MergeModal.tsx
git commit -m "feat: integrate BranchCombobox into CheckoutModal and MergeModal"
```
