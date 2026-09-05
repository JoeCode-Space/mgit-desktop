package main

import (
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Modules map[string][]string `yaml:"modules"`
}

var cfgFile = "mgit.yaml"

func loadConfig() (*Config, error) {
	data, err := os.ReadFile(cfgFile)
	if err != nil {
		return nil, err
	}
	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, err
	}
	return &config, nil
}

func scanDirectory(dir string) (int, int, error) {
	groupedRepos := make(map[string][]string)

	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() && d.Name() == ".git" {
			repoPath := filepath.Dir(path)
			
			// Determine group name based on top-level directory (relative to scanned dir)
			relPath, _ := filepath.Rel(dir, repoPath)
			groupName := "root"
			if relPath != "." && relPath != ".." {
				parts := strings.Split(filepath.ToSlash(relPath), "/")
				if len(parts) > 0 && parts[0] != "" {
					groupName = parts[0]
				}
			}

			groupedRepos[groupName] = append(groupedRepos[groupName], repoPath)
			return filepath.SkipDir
		}
		if d.IsDir() && (d.Name() == "node_modules" || d.Name() == "target" || d.Name() == "build" || d.Name() == ".idea") {
			return filepath.SkipDir
		}
		return nil
	})

	if err != nil {
		return 0, 0, err
	}

	if len(groupedRepos) == 0 {
		return 0, 0, nil
	}

	var config Config
	data, err := os.ReadFile(cfgFile)
	if err == nil {
		yaml.Unmarshal(data, &config)
	}
	
	if config.Modules == nil {
		config.Modules = make(map[string][]string)
	}
	
	totalRepos := 0
	for group, repos := range groupedRepos {
		config.Modules[group] = repos
		totalRepos += len(repos)
	}

	outData, err := yaml.Marshal(&config)
	if err != nil {
		return 0, 0, err
	}

	err = os.WriteFile(cfgFile, outData, 0644)
	if err != nil {
		return 0, 0, err
	}

	return totalRepos, len(groupedRepos), nil
}

type RepoStatus struct {
	Path   string
	Branch string
	Dirty  bool
}

func getModuleStatus(moduleName string) ([]RepoStatus, error) {
	config, err := loadConfig()
	if err != nil {
		return nil, err
	}

	repos, ok := config.Modules[moduleName]
	if !ok {
		return nil, fmt.Errorf("module '%s' not found in config", moduleName)
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	var statuses []RepoStatus

	for _, repo := range repos {
		wg.Add(1)
		go func(r string) {
			defer wg.Done()

			branchCmd := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD")
			branchCmd.Dir = r
			branchOut, err := branchCmd.Output()
			branch := "unknown"
			if err == nil {
				branch = strings.TrimSpace(string(branchOut))
			} else {
				branch = "No commits yet"
			}

			statusCmd := exec.Command("git", "status", "--porcelain")
			statusCmd.Dir = r
			statusOut, _ := statusCmd.Output()

			dirty := len(strings.TrimSpace(string(statusOut))) > 0

			mu.Lock()
			statuses = append(statuses, RepoStatus{
				Path:   r,
				Branch: branch,
				Dirty:  dirty,
			})
			mu.Unlock()
		}(repo)
	}
	wg.Wait()
	return statuses, nil
}

type LogCallback func(msg string)

func runGitCheckout(moduleName, targetBranch, baseBranch string, createBranch bool, log LogCallback) {
	config, err := loadConfig()
	if err != nil {
		log(fmt.Sprintf("❌ Error loading config: %v", err))
		return
	}
	repos, ok := config.Modules[moduleName]
	if !ok {
		log(fmt.Sprintf("❌ Module '%s' not found.", moduleName))
		return
	}

	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, repo := range repos {
		wg.Add(1)
		go func(r string) {
			defer wg.Done()
			var coCmd *exec.Cmd
			if createBranch {
				if baseBranch != "" {
					coCmd = exec.Command("git", "checkout", "-b", targetBranch, baseBranch)
				} else {
					coCmd = exec.Command("git", "checkout", "-b", targetBranch)
				}
			} else {
				coCmd = exec.Command("git", "checkout", targetBranch)
			}
			coCmd.Dir = r
			out, err := coCmd.CombinedOutput()

			mu.Lock()
			if err != nil {
				errMsg := strings.TrimSpace(string(out))
				log(fmt.Sprintf("❌ [%s] Failed: %s", filepath.Base(r), errMsg))
			} else {
				if createBranch {
					log(fmt.Sprintf("✅ [%s] Created and switched to %s", filepath.Base(r), targetBranch))
				} else {
					log(fmt.Sprintf("✅ [%s] Switched to %s", filepath.Base(r), targetBranch))
				}
			}
			mu.Unlock()
		}(repo)
	}
	wg.Wait()
	log(fmt.Sprintf("🏁 Checkout completed for module '%s'.", moduleName))
}

func runGitPull(moduleName string, log LogCallback) {
	config, err := loadConfig()
	if err != nil {
		log(fmt.Sprintf("❌ Error loading config: %v", err))
		return
	}
	repos, ok := config.Modules[moduleName]
	if !ok {
		log(fmt.Sprintf("❌ Module '%s' not found.", moduleName))
		return
	}

	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, repo := range repos {
		wg.Add(1)
		go func(r string) {
			defer wg.Done()
			pullCmd := exec.Command("git", "pull", "--no-edit")
			pullCmd.Dir = r
			out, err := pullCmd.CombinedOutput()

			mu.Lock()
			if err != nil {
				errMsg := strings.TrimSpace(string(out))
				log(fmt.Sprintf("❌ [%s] Failed: %s", filepath.Base(r), errMsg))
			} else {
				outStr := strings.TrimSpace(string(out))
				if strings.Contains(outStr, "Already up to date") {
					log(fmt.Sprintf("✅ [%s] Already up to date", filepath.Base(r)))
				} else {
					lines := strings.Split(outStr, "\n")
					summary := lines[len(lines)-1]
					if len(lines) == 1 {
						summary = strings.TrimSpace(lines[0])
					}
					log(fmt.Sprintf("✅ [%s] Pulled successfully (%s)", filepath.Base(r), summary))
				}
			}
			mu.Unlock()
		}(repo)
	}
	wg.Wait()
	log(fmt.Sprintf("🏁 Pull completed for module '%s'.", moduleName))
}

func runGitMerge(moduleName, targetBranch string, log LogCallback) {
	config, err := loadConfig()
	if err != nil {
		log(fmt.Sprintf("❌ Error loading config: %v", err))
		return
	}
	repos, ok := config.Modules[moduleName]
	if !ok {
		log(fmt.Sprintf("❌ Module '%s' not found.", moduleName))
		return
	}

	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, repo := range repos {
		wg.Add(1)
		go func(r string) {
			defer wg.Done()
			mergeCmd := exec.Command("git", "merge", "--no-edit", targetBranch)
			mergeCmd.Dir = r
			out, err := mergeCmd.CombinedOutput()

			mu.Lock()
			if err != nil {
				errMsg := strings.TrimSpace(string(out))
				log(fmt.Sprintf("❌ [%s] Failed: %s", filepath.Base(r), errMsg))
			} else {
				outStr := strings.TrimSpace(string(out))
				if strings.Contains(outStr, "Already up to date") {
					log(fmt.Sprintf("✅ [%s] Already up to date", filepath.Base(r)))
				} else {
					lines := strings.Split(outStr, "\n")
					summary := lines[len(lines)-1]
					if len(lines) == 1 {
						summary = strings.TrimSpace(lines[0])
					}
					log(fmt.Sprintf("✅ [%s] Merged successfully (%s)", filepath.Base(r), summary))
				}
			}
			mu.Unlock()
		}(repo)
	}
	wg.Wait()
	log(fmt.Sprintf("🏁 Merge completed for module '%s'.", moduleName))
}
