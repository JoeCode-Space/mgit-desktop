pub mod config;
pub mod git;
pub mod models;
pub mod scanner;

use std::path::Path;
use std::process::Command;

use tauri::{command, generate_context, generate_handler, AppHandle, Builder, Emitter};

use crate::config::{load_config, save_config};
use crate::git::operations::{
    batch_checkout, batch_commit, batch_get_branches, batch_merge, batch_pull, batch_push,
    batch_status,
};
use crate::models::{BranchSummary, GitOpResult, MgitConfig, RepoStatus, ScanSummary};
use crate::scanner::scan_directory;

/// Load mgit.yaml from the specified workspace directory.
#[command]
fn load_workspace_config(workspace: String) -> Result<MgitConfig, String> {
    let config_path = Path::new(&workspace).join("mgit.yaml");
    load_config(&config_path)
}

/// Save mgit configuration to mgit.yaml in the specified workspace directory.
#[command]
fn save_workspace_config(workspace: String, config: MgitConfig) -> Result<(), String> {
    let config_path = Path::new(&workspace).join("mgit.yaml");
    save_config(&config_path, &config)
}

/// Scan workspace directory recursively to discover git repositories.
#[command]
fn scan_workspace(workspace: String) -> Result<ScanSummary, String> {
    scan_directory(Path::new(&workspace))
}

/// Get git status across multiple repositories in parallel.
#[command]
fn get_repos_status(workspace: String, repos: Vec<String>) -> Result<Vec<RepoStatus>, String> {
    Ok(batch_status(Path::new(&workspace), &repos))
}

/// 获取多个仓库的本地与远程分支聚合列表。
#[command]
fn get_workspace_branches(
    workspace: String,
    repos: Vec<String>,
) -> Result<BranchSummary, String> {
    Ok(batch_get_branches(Path::new(&workspace), &repos))
}

/// Pull latest changes across multiple repositories in parallel with real-time log emission.
#[command]
fn git_pull(
    app: AppHandle,
    workspace: String,
    repos: Vec<String>,
) -> Result<Vec<GitOpResult>, String> {
    let on_log = |log| {
        let _ = app.emit("mgit://log", log);
    };
    Ok(batch_pull(Path::new(&workspace), &repos, &on_log))
}

/// Push local commits across multiple repositories in parallel with real-time log emission.
#[command]
fn git_push(
    app: AppHandle,
    workspace: String,
    repos: Vec<String>,
) -> Result<Vec<GitOpResult>, String> {
    let on_log = |log| {
        let _ = app.emit("mgit://log", log);
    };
    Ok(batch_push(Path::new(&workspace), &repos, &on_log))
}

/// Checkout or create branch across multiple repositories in parallel with real-time log emission.
#[command]
fn git_checkout(
    app: AppHandle,
    workspace: String,
    repos: Vec<String>,
    branch: String,
    create: bool,
    base: Option<String>,
) -> Result<Vec<GitOpResult>, String> {
    let on_log = |log| {
        let _ = app.emit("mgit://log", log);
    };
    Ok(batch_checkout(
        Path::new(&workspace),
        &repos,
        &branch,
        create,
        base.as_deref(),
        &on_log,
    ))
}

/// Merge branch across multiple repositories in parallel with real-time log emission.
#[command]
fn git_merge(
    app: AppHandle,
    workspace: String,
    repos: Vec<String>,
    target: String,
) -> Result<Vec<GitOpResult>, String> {
    let on_log = |log| {
        let _ = app.emit("mgit://log", log);
    };
    Ok(batch_merge(
        Path::new(&workspace),
        &repos,
        &target,
        &on_log,
    ))
}

/// Stage, commit, and optionally push changes across multiple repositories in parallel.
#[command]
fn git_commit(
    app: AppHandle,
    workspace: String,
    repos: Vec<String>,
    message: String,
    push: bool,
) -> Result<Vec<GitOpResult>, String> {
    let on_log = |log| {
        let _ = app.emit("mgit://log", log);
    };
    Ok(batch_commit(
        Path::new(&workspace),
        &repos,
        &message,
        push,
        &on_log,
    ))
}

/// Open workspace or repository path in platform-specific terminal emulator.
#[command]
fn open_in_terminal(path: String) -> Result<(), String> {
    let mut cmd = if cfg!(target_os = "macos") {
        let mut c = Command::new("open");
        c.args(["-a", "Terminal", &path]);
        c
    } else if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.args(["/C", "start", "powershell"]).current_dir(&path);
        c
    } else {
        let mut c = Command::new("x-terminal-emulator");
        c.current_dir(&path);
        c
    };

    cmd.spawn()
        .map_err(|err| format!("Failed to open terminal for '{}': {}", path, err))?;
    Ok(())
}

/// Open workspace or repository path in platform-specific file manager.
#[command]
fn open_in_finder(path: String) -> Result<(), String> {
    let mut cmd = if cfg!(target_os = "macos") {
        let mut c = Command::new("open");
        c.arg(&path);
        c
    } else if cfg!(target_os = "windows") {
        let mut c = Command::new("explorer");
        c.arg(&path);
        c
    } else {
        let mut c = Command::new("xdg-open");
        c.arg(&path);
        c
    };

    cmd.spawn()
        .map_err(|err| format!("Failed to open file manager for '{}': {}", path, err))?;
    Ok(())
}

/// Pick a directory using the platform native folder open dialog.
#[command]
fn pick_directory(default_path: Option<String>) -> Result<Option<String>, String> {
    if cfg!(target_os = "macos") {
        let script = if let Some(ref p) = default_path {
            if Path::new(p).exists() {
                format!(
                    "POSIX path of (choose folder with prompt \"请选择工作区目录\" default location POSIX file \"{}\")",
                    p.replace('"', "\\\"")
                )
            } else {
                "POSIX path of (choose folder with prompt \"请选择工作区目录\")".to_string()
            }
        } else {
            "POSIX path of (choose folder with prompt \"请选择工作区目录\")".to_string()
        };

        let output = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output()
            .map_err(|e| format!("调用系统对话框失败: {}", e))?;

        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let trimmed_path = path.trim_end_matches('/').to_string();
            if !trimmed_path.is_empty() {
                return Ok(Some(trimmed_path));
            }
        }
        Ok(None)
    } else {
        Ok(None)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    Builder::default()
        .invoke_handler(generate_handler![
            load_workspace_config,
            save_workspace_config,
            scan_workspace,
            get_repos_status,
            get_workspace_branches,
            git_pull,
            git_push,
            git_checkout,
            git_merge,
            git_commit,
            open_in_terminal,
            open_in_finder,
            pick_directory,
        ])
        .setup(|_app| Ok(()))
        .run(generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;
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

    #[test]
    fn test_load_and_save_workspace_config_commands() {
        let temp = TempDirGuard::new("mgit_cmd_config_test");
        let ws = temp.path().to_string_lossy().to_string();

        let mut modules = BTreeMap::new();
        modules.insert("core".to_string(), vec!["services/core".to_string()]);
        let config = MgitConfig { modules };

        let save_result = save_workspace_config(ws.clone(), config.clone());
        assert!(save_result.is_ok(), "save_workspace_config should succeed");

        let loaded = load_workspace_config(ws.clone()).expect("load_workspace_config should succeed");
        assert_eq!(config, loaded);

        // Loading from non-existent directory should return Err
        let err_load = load_workspace_config("/non/existent/path/for/sure".to_string());
        assert!(err_load.is_err());
    }

    #[test]
    fn test_scan_workspace_command() {
        let temp = TempDirGuard::new("mgit_cmd_scan_test");
        let ws = temp.path().to_string_lossy().to_string();

        create_dir_all(temp.path().join("pkg-a/.git")).unwrap();
        create_dir_all(temp.path().join("pkg-b/.git")).unwrap();

        let summary = scan_workspace(ws).expect("scan_workspace should succeed");
        assert_eq!(summary.total_repos, 2);
        assert!(summary.modules.contains_key("pkg-a"));
        assert!(summary.modules.contains_key("pkg-b"));
    }

    #[test]
    fn test_get_repos_status_command() {
        let temp = TempDirGuard::new("mgit_cmd_status_test");
        let ws_path = temp.path();
        let ws = ws_path.to_string_lossy().to_string();

        let repo_dir = ws_path.join("repo-x");
        create_dir_all(&repo_dir).unwrap();

        let _ = Command::new("git").args(["init"]).current_dir(&repo_dir).output();
        let _ = Command::new("git").args(["config", "user.name", "tester"]).current_dir(&repo_dir).output();
        let _ = Command::new("git").args(["config", "user.email", "test@test.com"]).current_dir(&repo_dir).output();

        write(repo_dir.join("init.txt"), "hello").unwrap();
        let _ = Command::new("git").args(["add", "-A"]).current_dir(&repo_dir).output();
        let _ = Command::new("git").args(["commit", "-m", "init"]).current_dir(&repo_dir).output();

        let repos = vec!["repo-x".to_string()];
        let statuses = get_repos_status(ws, repos).expect("get_repos_status should succeed");
        assert_eq!(statuses.len(), 1);
        assert_eq!(statuses[0].name, "repo-x");
        assert!(!statuses[0].dirty);
    }

    #[test]
    fn test_get_workspace_branches_command() {
        let temp = TempDirGuard::new("mgit_cmd_branches_test");
        let ws_path = temp.path();
        let ws = ws_path.to_string_lossy().to_string();

        let repo_dir = ws_path.join("repo-y");
        create_dir_all(&repo_dir).unwrap();

        let _ = Command::new("git").args(["init"]).current_dir(&repo_dir).output();
        let _ = Command::new("git").args(["config", "user.name", "tester"]).current_dir(&repo_dir).output();
        let _ = Command::new("git").args(["config", "user.email", "test@test.com"]).current_dir(&repo_dir).output();

        write(repo_dir.join("init.txt"), "hello").unwrap();
        let _ = Command::new("git").args(["add", "-A"]).current_dir(&repo_dir).output();
        let _ = Command::new("git").args(["commit", "-m", "init"]).current_dir(&repo_dir).output();
        let _ = Command::new("git").args(["checkout", "-b", "feature/my-branch"]).current_dir(&repo_dir).output();

        let repos = vec!["repo-y".to_string()];
        let summary = get_workspace_branches(ws, repos).expect("get_workspace_branches should succeed");
        assert!(summary.local.contains(&"feature/my-branch".to_string()));
    }
}
