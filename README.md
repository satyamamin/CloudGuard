# my-project

> **Template repo** — clone and rename for each new project.

## Structure

```
my-project/
├── .github/workflows/          # GitHub Actions CI/CD
├── .azuredevops/pipelines/     # Azure DevOps CI/CD (alternative)
├── terraform/
│   ├── modules/                # Reusable modules
│   ├── environments/           # Per-environment config (dev/staging/prod)
│   └── shared/                 # Shared provider config
├── scripts/
│   ├── bash/                   # Shell scripts (Linux/WSL/pipeline)
│   ├── powershell/             # PowerShell scripts (Windows/cross-platform)
│   └── python/                 # Python scripts
├── docs/                       # Architecture & runbook
├── .gitignore
├── Makefile                    # Single entrypoint for all tasks
└── README.md
```

## Getting started

```bash
# 1. Clone this template
cp -r my-project my-new-project
cd my-new-project

# 2. Init Terraform for dev
make init ENV=dev

# 3. Plan
make plan ENV=dev

# 4. Apply
make apply ENV=dev
```

## Prerequisites
- Terraform >= 1.5
- Azure CLI
- PowerShell 7+
