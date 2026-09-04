use std::collections::BTreeMap;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct MgitConfig {
    #[serde(default)]
    pub modules: BTreeMap<String, Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct ScanSummary {
    pub total_repos: usize,
    pub total_modules: usize,
    pub modules: BTreeMap<String, Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct RepoStatus {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub branch: String,
    pub dirty: bool,
    pub ahead: usize,
    pub behind: usize,
    pub latest_commit: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct GitOpResult {
    pub repo: String,
    pub success: bool,
    pub message: String,
    pub raw_output: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct LogEvent {
    pub timestamp: String,
    pub level: String,
    pub repo: Option<String>,
    pub message: String,
}
