# DevOps & Configuration Guide

This document provides a comprehensive guide to the DevOps setup and configuration files for the Mirage Media Scape project.

## Table of Contents

1. [Configuration Files Overview](#configuration-files-overview)
2. [Development Setup](#development-setup)
3. [CI/CD Pipeline](#cicd-pipeline)
4. [Security & Quality](#security--quality)
5. [Git Hooks & Automation](#git-hooks--automation)
6. [Docker Setup](#docker-setup)
7. [Monitoring & Logging](#monitoring--logging)
8. [Troubleshooting](#troubleshooting)

## Configuration Files Overview

### Root Level

| File | Purpose |
|------|---------|
| `.editorconfig` | Editor configuration for consistent formatting across all files |
| `.npmrc` | NPM package manager configuration |
| `.nvmrc` | Node.js version specification |
| `.gitattributes` | Git attributes for line ending management |
| `.gitignore` | Files to ignore in git commits |
| `.prettierrc` | Code formatter configuration |
| `.prettierignore` | Files to exclude from prettier formatting |
| `commitlint.config.ts` | Commit message validation rules |
| `renovate.json` | Automated dependency update configuration |
| `security.yaml` | Security headers and CORS configuration |
| `.pre-commit-config.yaml` | Pre-commit hooks for local git operations |

### Frontend

| File | Purpose |
|------|---------|
| `.prettierrc` | Prettier configuration (inherited from root) |
| `.prettierignore` | Files to exclude from prettier formatting |
| `.lintstagedrc.json` | Lint-staged configuration for staged files |
| `.stylelintrc.json` | Stylelint configuration for CSS linting |
| `.env.example` | Environment variables template |
| `eslint.config.js` | ESLint configuration for TypeScript/TSX |

### Server

| File | Purpose |
|------|---------|
| `eslint.config.js` | ESLint configuration for Node.js backend |
| `.prettierrc` | Prettier configuration |
| `.lintstagedrc.json` | Lint-staged configuration |
| `.env.example` | Environment variables template |

### CI/CD

| File | Location | Purpose |
|------|----------|---------|
| `main.yml` | `.github/workflows/` | Main CI/CD pipeline |
| `codeql.yml` | `.github/workflows/` | Security scanning with CodeQL |
| `dependabot.yml` | `.github/` | Automated dependency updates |

### VS Code Configuration

| File | Location | Purpose |
|------|----------|---------|
| `settings.json` | `.vscode/` | VS Code workspace settings |
| `extensions.json` | `.vscode/` | Recommended extensions |
| `launch.json` | `.vscode/` | Debug configurations |

## Development Setup

### Prerequisites

- Node.js 20.14.0+ (use `.nvmrc` with nvm)
- npm 10+
- Git 2.30+
- Docker (optional)

### Initial Setup

```bash
# Use correct Node version
nvm use

# Install all dependencies
npm install
cd frontend && npm install
cd ../server && npm install

# Copy environment files
cp .env.example .env
cp frontend/.env.example frontend/.env.local
cp server/.env.example server/.env
```

### Installing Git Hooks

The project uses Husky for git hooks:

```bash
cd frontend

# Install husky (if not already installed)
npm install husky --save-dev

# Install hooks
npx husky install

# Make hooks executable
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
chmod +x .husky/pre-push
chmod +x .husky/prepare-commit-msg
```

### Pre-Commit Hooks

The following hooks are configured:

1. **pre-commit**: Runs linting, type checking, and formatting on changed files
2. **commit-msg**: Validates commit messages follow conventional commits format
3. **prepare-commit-msg**: Prepares commit messages (optional custom logic)
4. **pre-push**: Runs tests before pushing to remote

## CI/CD Pipeline

### Workflow Jobs

The `main.yml` workflow includes the following jobs:

#### 1. Quality (Code Quality & Linting)
- Runs on: Python 20, 22
- Tasks:
  - Frontend formatting check
  - Frontend linting
  - Frontend type checking
  - Server linting
  - Security audit

#### 2. Build (Build & Test)
- Runs after quality job
- Tasks:
  - Frontend build
  - Server build
  - Artifact upload

#### 3. Test (Unit Tests)
- Runs after quality job
- Tasks:
  - Server test suite execution
  - Coverage report upload to Codecov

#### 4. Security (Security Checks)
- Tasks:
  - NPM audit
  - Snyk vulnerability scanning

#### 5. Docker (Docker Build)
- Runs only on main branch
- Tasks:
  - Docker image build
  - Push to GitHub Container Registry

#### 6. Dependency Check
- Tasks:
  - Check for outdated dependencies
  - Validate package-lock.json

### Triggering Workflows

Workflows are triggered on:
- `push` to main, develop, staging branches
- `pull_request` to main, develop, staging branches
- Manual `workflow_dispatch`

## Security & Quality

### EditorConfig

Standardizes editor configuration across different IDEs:

```ini
[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
max_line_length = 100

[*.{js,jsx,ts,tsx}]
indent_style = space
indent_size = 2
```

### ESLint Configuration

**Frontend** (`frontend/eslint.config.js`):
- Uses TypeScript ESLint parser
- React hooks and refresh plugins
- Tailwind CSS support

**Server** (`server/eslint.config.js`):
- Node.js environment
- TypeScript strict mode
- Jest test environment

### Prettier Configuration

Consistent code formatting across all files:
- 2-space indentation
- Single quotes
- 100-character line width
- Trailing commas

### Stylelint Configuration

Frontend CSS/SCSS linting:
- Standard stylelint rules
- Tailwind CSS compatibility
- Prettier integration

### Commitlint Configuration

Enforces conventional commits:

```
<type>(<scope>): <subject>

Allowed types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Code style
- refactor: Code refactoring
- perf: Performance improvement
- test: Tests
- chore: Chores
- ci: CI/CD
- build: Build system
- revert: Revert commit
```

## Git Hooks & Automation

### Pre-Commit Hooks

Located in `.husky/` directory:

1. **Pre-commit**: Fixes linting and formatting issues
2. **Commit-msg**: Validates message format
3. **Prepare-commit-msg**: Optional custom preparation
4. **Pre-push**: Runs full test suite

### Renovate

Automated dependency updates via `renovate.json`:
- Weekly updates for minor/patch versions
- Monthly updates for major versions
- Auto-merge disabled
- Monorepo support

### Pre-Commit Framework

The `.pre-commit-config.yaml` includes:
- Trailing whitespace removal
- YAML, JSON formatting
- ESLint enforcement
- Prettier formatting
- Secret detection
- Docker linting

## Docker Setup

### Building Docker Image

```bash
docker build -t mirage-media-scape:latest .
```

### Running Docker Container

```bash
docker run -p 3001:3001 \
  -v /path/to/media:/app/media \
  -e MEDIA_PATHS=/app/media \
  mirage-media-scape:latest
```

### Docker Compose

```bash
docker-compose up -d
docker-compose down
```

### Multi-Stage Build

The Dockerfile uses a multi-stage build:
1. **Builder stage**: Installs dependencies and builds frontend/server
2. **Runtime stage**: Lean production image with FFmpeg

## Monitoring & Logging

### Environment Variables

See `.env.example` files in root, frontend, and server directories.

### Logging Levels

- `info` - General information
- `warn` - Warnings
- `error` - Errors
- `debug` - Debugging information

### Coverage Reports

Test coverage reports are uploaded to Codecov via CI/CD.

## Troubleshooting

### Git Hooks Not Working

```bash
# Make hooks executable
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
chmod +x .husky/pre-push

# Reinstall husky
cd frontend && npm install husky --save-dev && npx husky install
```

### ESLint Issues

```bash
# Clear ESLint cache
rm -rf .eslintcache

# Reinstall ESLint
npm install eslint --save-dev
```

### Node Version Mismatch

```bash
# Install specific Node version with nvm
nvm install 20.14.0
nvm use 20.14.0

# Verify
node --version
```

### Docker Build Failures

```bash
# Remove unused images
docker image prune -a

# Build with no cache
docker build --no-cache -t mirage-media-scape:latest .
```

### CI/CD Pipeline Failures

1. Check GitHub Actions logs
2. Verify environment variables
3. Check node_modules integrity
4. Run local tests: `npm test`

## Best Practices

1. **Always use conventional commits** - Enforced by commitlint
2. **Run checks before pushing** - Pre-push hooks validate code
3. **Keep dependencies updated** - Use Renovate for automated updates
4. **Review security advisories** - Check npm audit reports
5. **Use EditorConfig** - Ensure consistent formatting
6. **Follow ESLint rules** - Catch common mistakes early
7. **Write tests** - Required for CI/CD to pass
8. **Document changes** - Update README and docs

## Resources

- [EditorConfig Specification](https://editorconfig.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [ESLint Documentation](https://eslint.org/docs/)
- [Prettier Documentation](https://prettier.io/)
- [Husky Documentation](https://typicode.github.io/husky/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
