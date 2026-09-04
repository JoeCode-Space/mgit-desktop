use std::fs::{create_dir_all, read_to_string, write};
use std::path::Path;
use serde_yaml::{from_str, to_string};

use crate::models::MgitConfig;

/// Load and parse mgit configuration from a YAML file.
pub fn load_config(config_path: &Path) -> Result<MgitConfig, String> {
    if !config_path.exists() {
        return Err(format!(
            "Configuration file does not exist at '{}'",
            config_path.display()
        ));
    }

    let content = read_to_string(config_path)
        .map_err(|err| format!("Failed to read configuration file '{}': {}", config_path.display(), err))?;

    if content.trim().is_empty() {
        return Ok(MgitConfig::default());
    }

    from_str::<MgitConfig>(&content)
        .map_err(|err| format!("Failed to parse configuration file '{}': {}", config_path.display(), err))
}

/// Serialize and save mgit configuration to a YAML file.
pub fn save_config(config_path: &Path, config: &MgitConfig) -> Result<(), String> {
    let yaml_str = to_string(config)
        .map_err(|err| format!("Failed to serialize configuration to YAML: {}", err))?;

    if let Some(parent) = config_path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            create_dir_all(parent)
                .map_err(|err| format!("Failed to create directory '{}': {}", parent.display(), err))?;
        }
    }

    write(config_path, yaml_str)
        .map_err(|err| format!("Failed to write configuration to '{}': {}", config_path.display(), err))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;
    use std::env::temp_dir;
    use std::fs::remove_file;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn test_parse_yaml_format() {
        let yaml_data = r#"
modules:
  frontend:
    - /path/to/repo-a
    - /path/to/repo-b
  backend:
    - /path/to/repo-c
"#;
        let config: MgitConfig = from_str(yaml_data).expect("Should parse valid YAML");
        assert_eq!(config.modules.len(), 2);
        assert_eq!(
            config.modules.get("frontend").unwrap(),
            &vec!["/path/to/repo-a".to_string(), "/path/to/repo-b".to_string()]
        );
        assert_eq!(
            config.modules.get("backend").unwrap(),
            &vec!["/path/to/repo-c".to_string()]
        );
    }

    #[test]
    fn test_round_trip_serialization() {
        let mut modules = BTreeMap::new();
        modules.insert(
            "group1".to_string(),
            vec!["repo1".to_string(), "repo2".to_string()],
        );
        modules.insert("group2".to_string(), vec!["repo3".to_string()]);

        let original = MgitConfig { modules };
        let serialized = to_string(&original).expect("Serialization failed");
        let deserialized: MgitConfig = from_str(&serialized).expect("Deserialization failed");

        assert_eq!(original, deserialized);
    }

    #[test]
    fn test_file_save_and_load() {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let temp_path = temp_dir().join(format!("mgit_test_{}.yaml", timestamp));

        let mut modules = BTreeMap::new();
        modules.insert(
            "service".to_string(),
            vec!["/code/service-a".to_string(), "/code/service-b".to_string()],
        );
        let config = MgitConfig { modules };

        let save_res = save_config(&temp_path, &config);
        assert!(save_res.is_ok(), "save_config should succeed");

        let loaded = load_config(&temp_path).expect("load_config should succeed");
        assert_eq!(config, loaded);

        let _ = remove_file(&temp_path);
    }

    #[test]
    fn test_load_non_existent_file() {
        let fake_path = Path::new("/non/existent/path/mgit.yaml");
        let result = load_config(fake_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_load_empty_file() {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let temp_path = temp_dir().join(format!("mgit_empty_{}.yaml", timestamp));

        write(&temp_path, "").unwrap();
        let result = load_config(&temp_path).expect("Should handle empty file");
        assert!(result.modules.is_empty());

        let _ = remove_file(&temp_path);
    }

    #[test]
    fn test_load_invalid_yaml() {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let temp_path = temp_dir().join(format!("mgit_invalid_{}.yaml", timestamp));

        write(&temp_path, ": invalid : yaml :").unwrap();
        let result = load_config(&temp_path);
        assert!(result.is_err());

        let _ = remove_file(&temp_path);
    }
}
