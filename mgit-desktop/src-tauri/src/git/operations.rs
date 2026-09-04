use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use rayon::prelude::*;

use crate::git::executor::{
    get_repo_status, git_checkout, git_commit, git_merge, git_pull, git_push,
};
use crate::models::{GitOpResult, LogEvent, RepoStatus};

/// Helper to generate an ISO-8601 formatted UTC timestamp string.
pub fn current_timestamp() -> String {
    let now = SystemTime::now();
    let duration = now.duration_since(UNIX_EPOCH).unwrap_or_default();
    let secs = duration.as_secs();
    let days = (secs / 86400) as i64;
    let rem = (secs % 86400) as u32;
    let hours = rem / 3600;
    let minutes = (rem % 3600) / 60;
    let seconds = rem % 60;

    let z = days + 719468;
    let era = (if z >= 0 { z } else { z - 146096 }) / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1024 + doe / 1461 - doe / 142424) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y, m, d, hours, minutes, seconds
    )
}

/// Resolve repo string (relative or absolute) against workspace root.
fn resolve_repo_dir(workspace: &Path, repo: &str) -> PathBuf {
    let trimmed = repo.trim();
    if trimmed == "." || trimmed == "./" || trimmed.is_empty() {
        workspace.to_path_buf()
    } else {
        let p = Path::new(trimmed);
        if p.is_absolute() {
            p.to_path_buf()
        } else {
            workspace.join(p)
        }
    }
}

/// Generic helper to execute batch operations in parallel with logging.
fn run_batch_op<F, Op>(
    workspace: &Path,
    repos: &[String],
    op_name: &str,
    on_log: &F,
    op: Op,
) -> Vec<GitOpResult>
where
    F: Fn(LogEvent) + Send + Sync,
    Op: Fn(&Path) -> GitOpResult + Send + Sync,
{
    repos
        .par_iter()
        .map(|repo| {
            on_log(LogEvent {
                timestamp: current_timestamp(),
                level: "info".to_string(),
                repo: Some(repo.clone()),
                message: format!("Starting {} on '{}'", op_name, repo),
            });

            let repo_dir = resolve_repo_dir(workspace, repo);
            let result = if !repo_dir.exists() {
                GitOpResult {
                    repo: repo.clone(),
                    success: false,
                    message: format!("Directory does not exist: {}", repo_dir.display()),
                    raw_output: None,
                    error: Some(format!("Directory does not exist: {}", repo_dir.display())),
                }
            } else {
                let mut res = op(&repo_dir);
                res.repo = repo.clone();
                res
            };

            on_log(LogEvent {
                timestamp: current_timestamp(),
                level: if result.success {
                    "success".to_string()
                } else {
                    "error".to_string()
                },
                repo: Some(repo.clone()),
                message: format!(
                    "Finished {} on '{}' ({}): {}",
                    op_name,
                    repo,
                    if result.success { "success" } else { "failure" },
                    result.message
                ),
            });

            result
        })
        .collect()
}

/// Query repository status in parallel across multiple repositories.
pub fn batch_status(workspace: &Path, repos: &[String]) -> Vec<RepoStatus> {
    repos
        .par_iter()
        .filter_map(|repo| {
            let repo_dir = resolve_repo_dir(workspace, repo);
            get_repo_status(&repo_dir, workspace).ok()
        })
        .collect()
}

/// Pull changes in parallel across multiple repositories.
pub fn batch_pull<F: Fn(LogEvent) + Send + Sync>(
    workspace: &Path,
    repos: &[String],
    on_log: &F,
) -> Vec<GitOpResult> {
    run_batch_op(workspace, repos, "pull", on_log, |dir| git_pull(dir))
}

/// Push changes in parallel across multiple repositories.
pub fn batch_push<F: Fn(LogEvent) + Send + Sync>(
    workspace: &Path,
    repos: &[String],
    on_log: &F,
) -> Vec<GitOpResult> {
    run_batch_op(workspace, repos, "push", on_log, |dir| git_push(dir))
}

/// Checkout branch in parallel across multiple repositories.
pub fn batch_checkout<F: Fn(LogEvent) + Send + Sync>(
    workspace: &Path,
    repos: &[String],
    branch: &str,
    create: bool,
    base: Option<&str>,
    on_log: &F,
) -> Vec<GitOpResult> {
    run_batch_op(workspace, repos, "checkout", on_log, |dir| {
        git_checkout(dir, branch, create, base)
    })
}

/// Merge target branch in parallel across multiple repositories.
pub fn batch_merge<F: Fn(LogEvent) + Send + Sync>(
    workspace: &Path,
    repos: &[String],
    target: &str,
    on_log: &F,
) -> Vec<GitOpResult> {
    run_batch_op(workspace, repos, "merge", on_log, |dir| {
        git_merge(dir, target)
    })
}

/// Stage and commit changes in parallel across multiple repositories.
pub fn batch_commit<F: Fn(LogEvent) + Send + Sync>(
    workspace: &Path,
    repos: &[String],
    message: &str,
    push: bool,
    on_log: &F,
) -> Vec<GitOpResult> {
    run_batch_op(workspace, repos, "commit", on_log, |dir| {
        git_commit(dir, message, push)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::temp_dir;
    use std::fs::{create_dir_all, remove_dir_all, write};
    use std::process::id as process_id;
    use std::sync::{Arc, Mutex};
    use crate::git::executor::run_git;

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

    fn init_repo_with_commit(dir: &Path, file_name: &str) {
        run_git(dir, &["init"]).expect("git init");
        run_git(dir, &["config", "user.name", "Test User"]).expect("config user.name");
        run_git(dir, &["config", "user.email", "test@example.com"]).expect("config user.email");

        let file = dir.join(file_name);
        write(&file, "initial content").unwrap();
        run_git(dir, &["add", "-A"]).expect("git add");
        run_git(dir, &["commit", "-m", "initial commit"]).expect("git commit");
    }

    #[test]
    fn test_batch_operations_and_logging() {
        let temp = TempDirGuard::new("mgit_batch_test");
        let ws = temp.path();

        let repo_names = vec![
            "packages/pkg-a".to_string(),
            "packages/pkg-b".to_string(),
            "apps/app-c".to_string(),
        ];

        for r in &repo_names {
            let repo_path = ws.join(r);
            create_dir_all(&repo_path).unwrap();
            init_repo_with_commit(&repo_path, "README.md");
        }

        // 1. Batch status
        let statuses = batch_status(ws, &repo_names);
        assert_eq!(statuses.len(), 3);
        for s in &statuses {
            assert!(!s.dirty);
            assert!(s.branch == "main" || s.branch == "master");
        }

        // Shared log collector
        let logs: Arc<Mutex<Vec<LogEvent>>> = Arc::new(Mutex::new(Vec::new()));
        let log_sink = {
            let logs = Arc::clone(&logs);
            move |event: LogEvent| {
                let mut guard = logs.lock().unwrap();
                guard.push(event);
            }
        };

        // 2. Batch checkout new branch
        let checkout_results = batch_checkout(ws, &repo_names, "feature/parallel", true, None, &log_sink);
        assert_eq!(checkout_results.len(), 3);
        for res in &checkout_results {
            assert!(res.success, "Checkout failed: {:?}", res);
        }

        // Verify logs emitted (start + finish per repo = 6 logs minimum)
        {
            let guard = logs.lock().unwrap();
            assert!(guard.len() >= 6);
            assert!(guard.iter().any(|l| l.level == "info"));
            assert!(guard.iter().any(|l| l.level == "success"));
        }

        // 3. Batch commit changes
        for r in &repo_names {
            let f = ws.join(r).join("new_file.txt");
            write(&f, "content").unwrap();
        }

        let commit_results = batch_commit(ws, &repo_names, "batch test commit", false, &log_sink);
        assert_eq!(commit_results.len(), 3);
        for res in &commit_results {
            assert!(res.success, "Commit failed: {:?}", res);
        }

        // Verify status reflects new commits
        let statuses_after = batch_status(ws, &repo_names);
        assert_eq!(statuses_after.len(), 3);
        for s in &statuses_after {
            assert_eq!(s.branch, "feature/parallel");
            assert!(s.latest_commit.contains("batch test commit"));
        }

        // 4. Batch error handling for non-existent repo
        let invalid_repos = vec!["non_existent_repo".to_string()];
        let err_results = batch_checkout(ws, &invalid_repos, "test", false, None, &log_sink);
        assert_eq!(err_results.len(), 1);
        assert!(!err_results[0].success);

        {
            let guard = logs.lock().unwrap();
            assert!(guard.iter().any(|l| l.level == "error"));
        }
    }
}
