use std::collections::{BTreeMap, HashSet};
use std::fs::read_dir;
use std::path::{Component, Path, PathBuf};

use crate::models::ScanSummary;

const IGNORED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "build",
    "dist",
    ".idea",
    ".vscode",
    ".gradle",
    "Pods",
    "vendor",
];

/// Check if a directory name should be ignored during scanning.
fn is_ignored_dir(name: &str) -> bool {
    IGNORED_DIRS
        .iter()
        .any(|&ignored| ignored == name || ignored.eq_ignore_ascii_case(name))
}

/// Check if a path represents a git repository (.git folder or file exists).
fn is_git_repo(path: &Path) -> bool {
    if !path.is_dir() {
        return false;
    }
    let git_entry = path.join(".git");
    git_entry.exists()
}

/// Compute module name and normalized relative path from root directory.
fn compute_relative_path(root_dir: &Path, repo_path: &Path) -> Result<(String, String), String> {
    let rel = match repo_path.strip_prefix(root_dir) {
        Ok(p) => p.to_path_buf(),
        Err(_) => {
            let canon_root = root_dir.canonicalize().map_err(|e| e.to_string())?;
            let canon_repo = repo_path.canonicalize().map_err(|e| e.to_string())?;
            canon_repo
                .strip_prefix(&canon_root)
                .map(|p| p.to_path_buf())
                .map_err(|err| {
                    format!(
                        "Failed to determine relative path for '{}': {}",
                        repo_path.display(),
                        err
                    )
                })?
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
        Ok(("root".to_string(), "./".to_string()))
    } else {
        let group_name = parts[0].clone();
        let rel_path = parts.join("/");
        Ok((group_name, rel_path))
    }
}

/// Recursively traverse directories starting from `current_dir`.
fn scan_recursive(
    current_dir: &Path,
    root_dir: &Path,
    modules: &mut BTreeMap<String, Vec<String>>,
    visited: &mut HashSet<PathBuf>,
) -> Result<(), String> {
    if let Ok(canonical) = current_dir.canonicalize() {
        if !visited.insert(canonical) {
            return Ok(());
        }
    }

    let entries = match read_dir(current_dir) {
        Ok(entries) => entries,
        Err(err) => {
            if current_dir == root_dir {
                return Err(format!(
                    "Failed to read directory '{}': {}",
                    current_dir.display(),
                    err
                ));
            }
            return Ok(());
        }
    };

    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        let file_name = entry.file_name();
        let name_str = file_name.to_string_lossy();

        if is_ignored_dir(&name_str) {
            continue;
        }

        let is_dir = match entry.file_type() {
            Ok(ft) => ft.is_dir(),
            Err(_) => path.is_dir(),
        };

        if !is_dir {
            continue;
        }

        if is_git_repo(&path) {
            let (module_name, rel_path) = compute_relative_path(root_dir, &path)?;
            modules.entry(module_name).or_default().push(rel_path);
            // Prune search: do not recurse into discovered git repository
            continue;
        }

        scan_recursive(&path, root_dir, modules, visited)?;
    }

    Ok(())
}

/// Recursively scan `root_dir` to discover git repositories and group them into modules.
pub fn scan_directory(root_dir: &Path) -> Result<ScanSummary, String> {
    if !root_dir.exists() {
        return Err(format!("Directory does not exist: {}", root_dir.display()));
    }
    if !root_dir.is_dir() {
        return Err(format!("Path is not a directory: {}", root_dir.display()));
    }

    let mut modules: BTreeMap<String, Vec<String>> = BTreeMap::new();
    let mut visited = HashSet::new();

    // Check if root directory itself is a git repository
    if is_git_repo(root_dir) {
        modules
            .entry("root".to_string())
            .or_default()
            .push("./".to_string());
    }

    scan_recursive(root_dir, root_dir, &mut modules, &mut visited)?;

    // Sort repositories alphabetically in each module and deduplicate
    for repos in modules.values_mut() {
        repos.sort();
        repos.dedup();
    }

    let total_repos = modules.values().map(|r| r.len()).sum();
    let total_modules = modules.len();

    Ok(ScanSummary {
        total_repos,
        total_modules,
        modules,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::temp_dir;
    use std::fs::{create_dir_all, remove_dir_all, File};
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
    fn test_scan_directory_with_sub_repos_and_ignored() {
        let temp = TempDirGuard::new("mgit_scan_test");
        let root = temp.path();

        // Simulated repos: root, services/svc-a, services/svc-b, apps/web
        create_dir_all(root.join(".git")).unwrap();
        create_dir_all(root.join("services/svc-a/.git")).unwrap();
        create_dir_all(root.join("services/svc-b/.git")).unwrap();
        create_dir_all(root.join("apps/web/.git")).unwrap();

        // Simulated ignored directories with fake .git inside
        create_dir_all(root.join("node_modules/fake-pkg/.git")).unwrap();
        create_dir_all(root.join("target/junk/.git")).unwrap();
        create_dir_all(root.join("build/tmp/.git")).unwrap();
        create_dir_all(root.join("dist/bundle/.git")).unwrap();
        create_dir_all(root.join(".idea/vcs/.git")).unwrap();
        create_dir_all(root.join(".vscode/ext/.git")).unwrap();
        create_dir_all(root.join(".gradle/cache/.git")).unwrap();
        create_dir_all(root.join("Pods/lib/.git")).unwrap();
        create_dir_all(root.join("vendor/bundle/.git")).unwrap();

        let summary = scan_directory(root).expect("scan_directory should succeed");

        // Assert modules and relative paths
        assert_eq!(summary.total_modules, 3);
        assert_eq!(summary.total_repos, 4);

        let services = summary.modules.get("services").expect("services module should exist");
        assert_eq!(services, &vec!["services/svc-a".to_string(), "services/svc-b".to_string()]);

        let apps = summary.modules.get("apps").expect("apps module should exist");
        assert_eq!(apps, &vec!["apps/web".to_string()]);

        let root_module = summary.modules.get("root").expect("root module should exist");
        assert_eq!(root_module, &vec!["./".to_string()]);

        // Assert ignored directories are not present as modules
        assert!(!summary.modules.contains_key("node_modules"));
        assert!(!summary.modules.contains_key("target"));
        assert!(!summary.modules.contains_key("build"));
        assert!(!summary.modules.contains_key("dist"));
        assert!(!summary.modules.contains_key(".idea"));
        assert!(!summary.modules.contains_key(".vscode"));
        assert!(!summary.modules.contains_key(".gradle"));
        assert!(!summary.modules.contains_key("Pods"));
        assert!(!summary.modules.contains_key("vendor"));
    }

    #[test]
    fn test_scan_directory_without_root_repo() {
        let temp = TempDirGuard::new("mgit_noroot_test");
        let root = temp.path();

        create_dir_all(root.join("services/svc-a/.git")).unwrap();
        create_dir_all(root.join("apps/web/.git")).unwrap();
        create_dir_all(root.join("single-repo/.git")).unwrap();

        let summary = scan_directory(root).expect("scan_directory should succeed");

        assert_eq!(summary.total_modules, 3);
        assert_eq!(summary.total_repos, 3);
        assert!(!summary.modules.contains_key("root"));

        assert_eq!(summary.modules.get("services").unwrap(), &vec!["services/svc-a".to_string()]);
        assert_eq!(summary.modules.get("apps").unwrap(), &vec!["apps/web".to_string()]);
        assert_eq!(summary.modules.get("single-repo").unwrap(), &vec!["single-repo".to_string()]);
    }

    #[test]
    fn test_scan_git_file_worktree() {
        let temp = TempDirGuard::new("mgit_file_test");
        let root = temp.path();

        let repo_dir = root.join("services/submod");
        create_dir_all(&repo_dir).unwrap();
        File::create(repo_dir.join(".git")).unwrap();

        let summary = scan_directory(root).expect("scan_directory should succeed");
        assert_eq!(summary.total_repos, 1);
        assert_eq!(summary.modules.get("services").unwrap(), &vec!["services/submod".to_string()]);
    }

    #[test]
    fn test_scan_prune_inside_git_repo() {
        let temp = TempDirGuard::new("mgit_prune_test");
        let root = temp.path();

        // svc-a has a nested repo inside it; since svc-a is a git repo, scanner should prune it
        create_dir_all(root.join("services/svc-a/.git")).unwrap();
        create_dir_all(root.join("services/svc-a/nested-pkg/.git")).unwrap();

        let summary = scan_directory(root).expect("scan_directory should succeed");
        assert_eq!(summary.total_repos, 1);
        assert_eq!(summary.modules.get("services").unwrap(), &vec!["services/svc-a".to_string()]);
    }

    #[test]
    fn test_scan_non_existent_directory() {
        let fake_path = Path::new("/non/existent/path/for/mgit/scanner");
        let result = scan_directory(fake_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_scan_file_as_root() {
        let temp = TempDirGuard::new("mgit_file_root_test");
        let file_path = temp.path().join("dummy.txt");
        File::create(&file_path).unwrap();

        let result = scan_directory(&file_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not a directory"));
    }

    #[test]
    fn test_scan_empty_directory() {
        let temp = TempDirGuard::new("mgit_empty_test");
        let summary = scan_directory(temp.path()).expect("scan empty should succeed");
        assert_eq!(summary.total_repos, 0);
        assert_eq!(summary.total_modules, 0);
        assert!(summary.modules.is_empty());
    }
}
