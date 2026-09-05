package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/layout"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
)

func main() {
	a := app.New()
	w := a.NewWindow("mgit - Multi-Repo Git Manager")
	w.Resize(fyne.NewSize(900, 700)) // slightly larger default size

	// Data
	var currentModule string
	var modules []string

	// UI Components
	moduleSelect := widget.NewSelect([]string{}, nil)
	moduleSelect.PlaceHolder = "Select Module..."
	
	var repoData []RepoStatus
	
	repoList := widget.NewTable(
		func() (int, int) { return 0, 0 },
		func() fyne.CanvasObject { return widget.NewLabel("") },
		func(i widget.TableCellID, o fyne.CanvasObject) {},
	)
	
	logContent := widget.NewLabel("")
	logContent.Wrapping = fyne.TextWrapWord
	logScroll := container.NewVScroll(logContent)
	
	logFunc := func(msg string) {
		logContent.SetText(logContent.Text + msg + "\n")
		logScroll.ScrollToBottom()
	}

	refreshTable := func() {
		if currentModule == "" {
			return
		}
		logFunc(fmt.Sprintf("Refreshing status for module: %s...", currentModule))
		statuses, err := getModuleStatus(currentModule)
		if err != nil {
			logFunc(fmt.Sprintf("Error getting status: %v", err))
			return
		}
		repoData = statuses
		
		repoList.Length = func() (int, int) {
			return len(repoData) + 1, 3
		}
		repoList.CreateCell = func() fyne.CanvasObject {
			return widget.NewLabel("Template")
		}
		repoList.UpdateCell = func(id widget.TableCellID, o fyne.CanvasObject) {
			l := o.(*widget.Label)
			if id.Row == 0 {
				switch id.Col {
				case 0:
					l.SetText("Repository")
					l.TextStyle = fyne.TextStyle{Bold: true}
				case 1:
					l.SetText("Branch")
					l.TextStyle = fyne.TextStyle{Bold: true}
				case 2:
					l.SetText("Status")
					l.TextStyle = fyne.TextStyle{Bold: true}
				}
				return
			}
			r := repoData[id.Row-1]
			l.TextStyle = fyne.TextStyle{}
			switch id.Col {
			case 0:
				l.SetText(filepath.Base(r.Path))
			case 1:
				l.SetText(r.Branch)
			case 2:
				if r.Dirty {
					l.SetText("⚠️ Dirty")
				} else {
					l.SetText("✅ Clean")
				}
			}
		}
		repoList.SetColumnWidth(0, 250)
		repoList.SetColumnWidth(1, 250)
		repoList.SetColumnWidth(2, 150)
		repoList.Refresh()
		logFunc("Status refreshed.")
	}

	updateModules := func() {
		config, err := loadConfig()
		if err != nil {
			logFunc("No mgit.yaml found or error loading it.")
			return
		}
		modules = []string{}
		for m := range config.Modules {
			modules = append(modules, m)
		}
		sort.Strings(modules)
		moduleSelect.Options = modules
		moduleSelect.Refresh()
		if len(modules) > 0 && currentModule == "" {
			moduleSelect.SetSelected(modules[0])
		}
	}

	moduleSelect.OnChanged = func(s string) {
		currentModule = s
		refreshTable()
	}

	// Actions
	btnScan := widget.NewButtonWithIcon("Scan", theme.SearchIcon(), func() {
		dialog.ShowFolderOpen(func(lu fyne.ListableURI, err error) {
			if lu == nil || err != nil {
				return
			}
			path := lu.Path()
			logFunc(fmt.Sprintf("Scanning directory: %s", path))
			repos, mods, err := scanDirectory(path)
			if err != nil {
				logFunc(fmt.Sprintf("Scan error: %v", err))
				return
			}
			logFunc(fmt.Sprintf("Scan complete. Found %d repos across %d modules.", repos, mods))
			updateModules()
		}, w)
	})

	btnRefresh := widget.NewButtonWithIcon("Refresh", theme.ViewRefreshIcon(), func() {
		refreshTable()
	})

	btnPull := widget.NewButtonWithIcon("Pull", theme.DownloadIcon(), func() {
		if currentModule == "" {
			dialog.ShowInformation("Notice", "Please select a module first.", w)
			return
		}
		go func() {
			logFunc("Starting Pull...")
			runGitPull(currentModule, logFunc)
			refreshTable()
		}()
	})

	btnCheckout := widget.NewButtonWithIcon("Checkout", theme.NavigateNextIcon(), func() {
		if currentModule == "" {
			dialog.ShowInformation("Notice", "Please select a module first.", w)
			return
		}
		targetEntry := widget.NewEntry()
		targetEntry.PlaceHolder = "e.g. feature-branch"
		baseEntry := widget.NewEntry()
		baseEntry.PlaceHolder = "e.g. main (optional)"
		createCheck := widget.NewCheck("Create new branch (-b)", nil)

		items := []*widget.FormItem{
			widget.NewFormItem("Target Branch", targetEntry),
			widget.NewFormItem("Base Branch", baseEntry),
			widget.NewFormItem("", createCheck),
		}

		d := dialog.NewForm("Checkout Branch", "Checkout", "Cancel", items, func(b bool) {
			if !b {
				return
			}
			target := strings.TrimSpace(targetEntry.Text)
			base := strings.TrimSpace(baseEntry.Text)
			create := createCheck.Checked
			if target == "" {
				return
			}
			go func() {
				logFunc(fmt.Sprintf("Starting Checkout for %s...", target))
				runGitCheckout(currentModule, target, base, create, logFunc)
				refreshTable()
			}()
		}, w)
		d.Resize(fyne.NewSize(450, 250))
		d.Show()
	})

	btnMerge := widget.NewButtonWithIcon("Merge", theme.ContentAddIcon(), func() {
		if currentModule == "" {
			dialog.ShowInformation("Notice", "Please select a module first.", w)
			return
		}
		targetEntry := widget.NewEntry()
		targetEntry.PlaceHolder = "e.g. feature-branch"
		items := []*widget.FormItem{
			widget.NewFormItem("Branch to merge", targetEntry),
		}
		
		d := dialog.NewForm("Merge Branch", "Merge", "Cancel", items, func(b bool) {
			if !b {
				return
			}
			target := strings.TrimSpace(targetEntry.Text)
			if target == "" {
				return
			}
			go func() {
				logFunc(fmt.Sprintf("Starting Merge with %s...", target))
				runGitMerge(currentModule, target, logFunc)
				refreshTable()
			}()
		}, w)
		d.Resize(fyne.NewSize(400, 200))
		d.Show()
	})

	// Layout
	cwd, _ := os.Getwd()
	lblWorkspace := widget.NewLabel(fmt.Sprintf("Workspace: %s", cwd))
	lblWorkspace.TextStyle = fyne.TextStyle{Bold: true}
	
	btnChangeWorkspace := widget.NewButtonWithIcon("Change Workspace...", theme.FolderOpenIcon(), func() {
		dialog.ShowFolderOpen(func(lu fyne.ListableURI, err error) {
			if lu == nil || err != nil {
				return
			}
			path := lu.Path()
			os.Chdir(path)
			lblWorkspace.SetText(fmt.Sprintf("Workspace: %s", path))
			logFunc(fmt.Sprintf("Changed working directory to: %s", path))
			currentModule = ""
			moduleSelect.SetSelected("")
			updateModules()
		}, w)
	})

	workspaceBar := container.NewHBox(
		lblWorkspace,
		layout.NewSpacer(),
		btnChangeWorkspace,
	)

	toolbar := container.NewHBox(
		widget.NewLabelWithStyle("Module:", fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
		moduleSelect,
		layout.NewSpacer(),
		btnScan,
		btnRefresh,
		btnPull,
		btnCheckout,
		btnMerge,
	)

	topBar := widget.NewCard("Configuration & Actions", "", container.NewVBox(
		workspaceBar,
		widget.NewSeparator(),
		toolbar,
	))

	tableCard := widget.NewCard("Repositories", "", container.NewMax(repoList))
	logCard := widget.NewCard("Operation Logs", "", container.NewMax(logScroll))
	
	split := container.NewVSplit(tableCard, logCard)
	split.Offset = 0.65 

	content := container.NewBorder(container.NewPadded(topBar), nil, nil, nil, container.NewPadded(split))
	w.SetContent(content)

	updateModules()
	w.ShowAndRun()
}
