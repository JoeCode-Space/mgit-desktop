use std::collections::BTreeSet;
use std::path::{Component, Path};
use std::process::Command;

use crate::models::{BranchSummary, GitOpResult, RepoStatus};

/// Helper to format a fallback repository name from its directory path.
fn repo_name(repo_dir: &Path) -> String {
    repo_dir
        .file_name()
        .and_then(|n| n.to_str())
        .filter(|s| !s.is_empty())
        .unwrap_or("root")
        .to_string()
}

/// Helper to convert a Command result into a standardized GitOpResult.
fn make_result(repo: &str, res: Result<(i32, String, String), String>, op_name: &str) -> GitOpResult {
    match res {
        Ok((0, stdout, stderr)) => {
            let combined = if stderr.trim().is_empty() {
                stdout.trim().to_string()
            } else if stdout.trim().is_empty() {
                stderr.trim().to_string()
            } else {
                format!("{}\n{}", stdout.trim(), stderr.trim())
            };
            GitOpResult {
                repo: repo.to_string(),
                success: true,
                message: format!("{} succeeded", op_name),
                raw_output: if combined.is_empty() { None } else { Some(combined) },
                error: None,
            }
        }
        Ok((code, stdout, stderr)) => {
            let combined = format!("{}\n{}", stdout.trim(), stderr.trim()).trim().to_string();
            let err_msg = if !stderr.trim().is_empty() {
                stderr.trim().to_string()
            } else if !stdout.trim().is_empty() {
                stdout.trim().to_string()
            } else {
                format!("Process exited with status code {}", code)
            };
            GitOpResult {
                repo: repo.to_string(),
                success: false,
                message: format!("{} failed (exit code {})", op_name, code),
                raw_output: if combined.is_empty() { None } else { Some(combined) },
                error: Some(err_msg),
            }
        }
        Err(err) => GitOpResult {
            repo: repo.to_string(),
            success: false,
            message: format!("{} failed to execute", op_name),
            raw_output: None,
            error: Some(err),
        },
    }
}

/// Execute a git command in the specified directory with given arguments.
pub fn run_git(dir: &Path, args: &[&str]) -> Result<(i32, String, String), String> {
    let output = Command::new("git")
        .current_dir(dir)
        .args(args)
        .env("LC_ALL", "C")
        .output()
        .map_err(|err| format!("Failed to spawn git command {:?}: {}", args, err))?;

    let exit_code = output.status.code().unwrap_or(-1);
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    Ok((exit_code, stdout, stderr))
}

/// Retrieve the status of a git repository located at `repo_dir`, relative to `root_dir`.
pub fn get_repo_status(repo_dir: &Path, root_dir: &Path) -> Result<RepoStatus, String> {
    if !repo_dir.exists() {
        return Err(format!("Repository directory does not exist: '{}'", repo_dir.display()));
    }

    let (check_code, _, check_err) = run_git(repo_dir, &["rev-parse", "--is-inside-work-tree"])
        .map_err(|err| format!("Failed to check git repository status in '{}': {}", repo_dir.display(), err))?;

    if check_code != 0 {
        return Err(format!(
            "'{}' is not a git repository: {}",
            repo_dir.display(),
            check_err.trim()
        ));
    }

    // branch: git rev-parse --abbrev-ref HEAD (trim, fallback to "HEAD (detached)" or "No commits yet")
    let branch = match run_git(repo_dir, &["rev-parse", "--abbrev-ref", "HEAD"]) {
        Ok((0, stdout, _)) => {
            let trimmed = stdout.trim();
            if trimmed == "HEAD" {
                "HEAD (detached)".to_string()
            } else if trimmed.is_empty() {
                "No commits yet".to_string()
            } else {
                trimmed.to_string()
            }
        }
        _ => "No commits yet".to_string(),
    };

    // dirty: git status --porcelain (not empty => true)
    let dirty = match run_git(repo_dir, &["status", "--porcelain"]) {
        Ok((0, stdout, _)) => !stdout.trim().is_empty(),
        _ => false,
    };

    // ahead, behind: git rev-list --left-right --count HEAD...@{u}. Parse <ahead>\t<behind>. If fails, default (0, 0).
    let (ahead, behind) = match run_git(repo_dir, &["rev-list", "--left-right", "--count", "HEAD...@{u}"]) {
        Ok((0, stdout, _)) => {
            let parts: Vec<&str> = stdout.split_whitespace().collect();
            if parts.len() >= 2 {
                let a = parts[0].parse::<usize>().unwrap_or(0);
                let b = parts[1].parse::<usize>().unwrap_or(0);
                (a, b)
            } else {
                (0, 0)
            }
        }
        _ => (0, 0),
    };

    // latest_commit: git log -1 --format=%h %s. Fallback to "No commits".
    let latest_commit = match run_git(repo_dir, &["log", "-1", "--format=%h %s"]) {
        Ok((0, stdout, _)) => {
            let trimmed = stdout.trim();
            if trimmed.is_empty() {
                "No commits".to_string()
            } else {
                trimmed.to_string()
            }
        }
        _ => "No commits".to_string(),
    };

    // name: directory name or "root"
    let name = repo_name(repo_dir);

    // path: canonical or absolute string
    let path = repo_dir
        .canonicalize()
        .unwrap_or_else(|_| repo_dir.to_path_buf())
        .to_string_lossy()
        .to_string();

    // relative_path: relative to root_dir with forward slashes /
    let relative_path = {
        let rel = match repo_dir.strip_prefix(root_dir) {
            Ok(p) => p.to_path_buf(),
            Err(_) => {
                let canon_root = root_dir.canonicalize().unwrap_or_else(|_| root_dir.to_path_buf());
                let canon_repo = repo_dir.canonicalize().unwrap_or_else(|_| repo_dir.to_path_buf());
                canon_repo
                    .strip_prefix(&canon_root)
                    .map(|p| p.to_path_buf())
                    .unwrap_or_else(|_| repo_dir.to_path_buf())
            }
        };

        let parts: Vec<String> = rel
            .components()
            .filter_map(|c| match c {
                Component::Normal(os_str) => Some(os_str.to_string_lossy().to_string()),
                _ => None,
            })
            .collect();

        if parts.is_empty() {
            "./".to_string()
        } else {
            parts.join("/")
        }
    };

    Ok(RepoStatus {
        name,
        path,
        relative_path,
        branch,
        dirty,
        ahead,
        behind,
        latest_commit,
    })
}

/// Perform `git pull` in the specified repository directory.
pub fn git_pull(repo_dir: &Path) -> GitOpResult {
    let repo = repo_name(repo_dir);
    let res = run_git(repo_dir, &["pull"]);
    make_result(&repo, res, "pull")
}

/// Perform `git push` in the specified repository directory.
pub fn git_push(repo_dir: &Path) -> GitOpResult {
    let repo = repo_name(repo_dir);
    let res = run_git(repo_dir, &["push"]);
    make_result(&repo, res, "push")
}

/// Perform `git checkout` in the specified repository directory.
pub fn git_checkout(
    repo_dir: &Path,
    branch: &str,
    create: bool,
    base: Option<&str>,
) -> GitOpResult {
    let repo = repo_name(repo_dir);
    let res = if create {
        if let Some(base_branch) = base.map(|s| s.trim()).filter(|s| !s.is_empty()) {
            run_git(repo_dir, &["checkout", "-b", branch, base_branch])
        } else {
            run_git(repo_dir, &["checkout", "-b", branch])
        }
    } else {
        run_git(repo_dir, &["checkout", branch])
    };
    make_result(&repo, res, "checkout")
}

/// Perform `git merge` in the specified repository directory.
pub fn git_merge(repo_dir: &Path, target: &str) -> GitOpResult {
    let repo = repo_name(repo_dir);
    let res = run_git(repo_dir, &["merge", target]);
    make_result(&repo, res, "merge")
}

/// Perform `git commit` in the specified repository directory.
/// Stages all changes with `git add -A`, then runs `git commit -m <message>`.
/// If `push` is true and commit succeeded, executes `git push`.
pub fn git_commit(repo_dir: &Path, message: &str, push: bool) -> GitOpResult {
    let repo = repo_name(repo_dir);

    // Stage all changes
    match run_git(repo_dir, &["add", "-A"]) {
        Ok((0, _, _)) => {}
        Ok((code, stdout, stderr)) => {
            let combined = format!("{}\n{}", stdout.trim(), stderr.trim()).trim().to_string();
            let err_msg = if !stderr.trim().is_empty() {
                stderr.trim().to_string()
            } else if !stdout.trim().is_empty() {
                stdout.trim().to_string()
            } else {
                format!("git add failed with exit code {}", code)
            };
            return GitOpResult {
                repo,
                success: false,
                message: format!("Failed to stage changes (exit code {})", code),
                raw_output: if combined.is_empty() { None } else { Some(combined) },
                error: Some(err_msg),
            };
        }
        Err(err) => {
            return GitOpResult {
                repo,
                success: false,
                message: "Failed to execute git add".to_string(),
                raw_output: None,
                error: Some(err),
            };
        }
    }

    // Commit changes
    let commit_res = run_git(repo_dir, &["commit", "-m", message]);
    match commit_res {
        Ok((0, stdout, stderr)) => {
            if push {
                match run_git(repo_dir, &["push"]) {
                    Ok((0, push_stdout, push_stderr)) => {
                        let combined = format!(
                            "{}\n{}\n{}\n{}",
                            stdout.trim(),
                            stderr.trim(),
                            push_stdout.trim(),
                            push_stderr.trim()
                        )
                        .trim()
                        .to_string();

                        GitOpResult {
                            repo,
                            success: true,
                            message: "Commit and push successful".to_string(),
                            raw_output: if combined.is_empty() { None } else { Some(combined) },
                            error: None,
                        }
                    }
                    Ok((code, push_stdout, push_stderr)) => {
                        let combined = format!(
                            "{}\n{}\n{}\n{}",
                            stdout.trim(),
                            stderr.trim(),
                            push_stdout.trim(),
                            push_stderr.trim()
                        )
                        .trim()
                        .to_string();
                        let err_msg = if !push_stderr.trim().is_empty() {
                            push_stderr.trim().to_string()
                        } else if !push_stdout.trim().is_empty() {
                            push_stdout.trim().to_string()
                        } else {
                            format!("git push failed with exit code {}", code)
                        };

                        GitOpResult {
                            repo,
                            success: false,
                            message: format!("Commit succeeded, but push failed (exit code {})", code),
                            raw_output: if combined.is_empty() { None } else { Some(combined) },
                            error: Some(err_msg),
                        }
                    }
                    Err(err) => GitOpResult {
                        repo,
                        success: false,
                        message: "Commit succeeded, but failed to execute git push".to_string(),
                        raw_output: Some(stdout),
                        error: Some(err),
                    },
                }
            } else {
                let combined = if stderr.trim().is_empty() {
                    stdout.trim().to_string()
                } else if stdout.trim().is_empty() {
                    stderr.trim().to_string()
                } else {
                    format!("{}\n{}", stdout.trim(), stderr.trim())
                };

                GitOpResult {
                    repo,
                    success: true,
                    message: "Commit successful".to_string(),
                    raw_output: if combined.is_empty() { None } else { Some(combined) },
                    error: None,
                }
            }
        }
        Ok((code, stdout, stderr)) => {
            let combined = format!("{}\n{}", stdout.trim(), stderr.trim()).trim().to_string();
            let err_msg = if !stderr.trim().is_empty() {
                stderr.trim().to_string()
            } else if !stdout.trim().is_empty() {
                stdout.trim().to_string()
            } else {
                format!("git commit failed with exit code {}", code)
            };

            GitOpResult {
                repo,
                success: false,
                message: format!("Commit failed (exit code {})", code),
                raw_output: if combined.is_empty() { None } else { Some(combined) },
                error: Some(err_msg),
            }
        }
        Err(err) => GitOpResult {
            repo,
            success: false,
            message: "Failed to execute git commit".to_string(),
            raw_output: None,
            error: Some(err),
        },
    }
}

/// 获取指定仓库的本地分支与远程分支列表
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
            // 忽略 /HEAD 符号引用
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::temp_dir;
    use std::fs::{create_dir_all, remove_dir_all, write};
    use std::path::PathBuf;
    use std::process::id as process_id;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TempDirGuard {
        path: PathBuf,
    }

    impl TempDirGuard {
        fn new(prefix: &str) -> Self {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = temp_dir().join(format!("{}_{}_{}", prefix, process_id(), timestamp));
            create_dir_all(&path).unwrap();
            Self { path }
        }

        fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TempDirGuard {
        fn drop(&mut self) {
            let _ = remove_dir_all(&self.path);
        }
    }

    fn init_test_repo(dir: &Path) {
        run_git(dir, &["init"]).expect("git init failed");
        run_git(dir, &["config", "user.name", "Test User"]).expect("config user.name failed");
        run_git(dir, &["config", "user.email", "test@example.com"]).expect("config user.email failed");
    }

    #[test]
    fn test_git_workflow_lifecycle() {
        let temp = TempDirGuard::new("mgit_exec_test");
        let repo_path = temp.path();

        init_test_repo(repo_path);

        // Before any commits, rev-parse HEAD yields empty/error => "No commits yet"
        let initial_status = get_repo_status(repo_path, repo_path).expect("status before commit");
        assert_eq!(initial_status.branch, "No commits yet");
        assert_eq!(initial_status.latest_commit, "No commits");
        assert!(!initial_status.dirty);

        // Create a test file
        let file_path = repo_path.join("hello.txt");
        write(&file_path, "Hello Git").unwrap();

        // Dirty should now be true
        let dirty_status = get_repo_status(repo_path, repo_path).expect("status after file creation");
        assert!(dirty_status.dirty);

        // Test commit
        let commit_res = git_commit(repo_path, "initial test commit", false);
        assert!(commit_res.success, "Commit should succeed: {:?}", commit_res);

        // Status after commit: clean, branch main or master, latest_commit contains message
        let after_commit_status = get_repo_status(repo_path, repo_path).expect("status after commit");
        assert!(!after_commit_status.dirty);
        assert!(
            after_commit_status.branch == "main" || after_commit_status.branch == "master",
            "Branch was expected to be main or master, got {}",
            after_commit_status.branch
        );
        assert!(
            after_commit_status.latest_commit.contains("initial test commit"),
            "latest commit was: {}",
            after_commit_status.latest_commit
        );

        // Test checkout new branch
        let checkout_res = git_checkout(repo_path, "feature/test-branch", true, None);
        assert!(checkout_res.success, "Checkout -b should succeed: {:?}", checkout_res);

        let branch_status = get_repo_status(repo_path, repo_path).expect("status on feature branch");
        assert_eq!(branch_status.branch, "feature/test-branch");

        // Test commit on feature branch
        write(&file_path, "Feature Update").unwrap();
        let feat_commit = git_commit(repo_path, "feature commit", false);
        assert!(feat_commit.success);

        // Switch back to original branch
        let switch_back = git_checkout(repo_path, &after_commit_status.branch, false, None);
        assert!(switch_back.success);

        // Test merge
        let merge_res = git_merge(repo_path, "feature/test-branch");
        assert!(merge_res.success, "Merge should succeed: {:?}", merge_res);
    }

    #[test]
    fn test_non_existent_and_invalid_repo() {
        let fake_path = Path::new("/path/that/does/not/exist/anywhere");
        let status_res = get_repo_status(fake_path, fake_path);
        assert!(status_res.is_err());
        assert!(status_res.unwrap_err().contains("does not exist"));

        let temp = TempDirGuard::new("mgit_not_a_repo");
        let non_repo_status = get_repo_status(temp.path(), temp.path());
        assert!(non_repo_status.is_err());
        assert!(non_repo_status.unwrap_err().contains("not a git repository"));
    }

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
}
