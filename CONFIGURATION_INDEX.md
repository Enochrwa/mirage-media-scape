# Configuration Files Index

Quick reference guide to all configuration files in the Mirage Media Scape project.

## 📋 Root Configuration Files

### Code Quality & Formatting

- **`.editorconfig`** - Cross-IDE editor configuration
- **`.prettierrc`** - Code formatter settings
- **`.prettierignore`** - Prettier exclusion patterns

### Package Management

- **`.npmrc`** - NPM configuration (exact versions, audit level, registry)
- **`.nvmrc`** - Node.js version (20.14.0)
- **`renovate.json`** - Automated dependency updates
- **`.github/dependabot.yml`** - Dependabot configuration

### Version Control

- **`.gitignore`** - Files to ignore in git (enhanced)
- **`.gitattributes`** - Line ending and export management

### Git Hooks & Commits

- **`commitlint.config.ts`** - Conventional commit validation
- **`.pre-commit-config.yaml`** - Pre-commit framework hooks
- **`.husky/pre-commit`** - Lint before commit
- **`.husky/commit-msg`** - Validate commit message
- **`.husky/pre-push`** - Test before push
- **`.husky/prepare-commit-msg`** - Message preparation

### Security & DevOps

- **`security.yaml`** - Security headers and CORS settings
- **`sonar-project.properties`** - SonarQube analysis configuration
- **`.dockerlintrc.json`** - Docker linting rules

### Environment

- **`.env.example`** - Root environment variables template

### Testing

- **`.jestrc.json`** - Jest configuration

## 🎨 Frontend Configuration

Located in `/frontend/`:

- **`.env.example`** - Frontend-specific environment variables
- **`.stylelintrc.json`** - CSS/SCSS linting configuration
- **`eslint.config.js`** - TypeScript/React ESLint (existing, may be enhanced)
- **`.prettierrc`** - Inherited from root
- **`.prettierignore`** - Inherited from root
- **`.lintstagedrc.json`** - Lint-staged configuration (existing)

## 🔧 Server Configuration

Located in `/server/`:

- **`.env.example`** - Server-specific environment variables
- **`eslint.config.js`** - Node.js ESLint configuration
- **`.prettierrc`** - Code formatter configuration
- **`.lintstagedrc.json`** - Lint-staged configuration

## 📦 CI/CD Workflows

Located in `.github/`:

### Workflows Directory (`.github/workflows/`)

- **`main.yml`** - Main CI/CD pipeline (enhanced)
  - Quality checks
  - Build jobs
  - Unit tests
  - Security scanning
  - Docker building
  - Dependency checking
- **`codeql.yml`** - CodeQL security analysis

### GitHub Config (`.github/`)

- **`dependabot.yml`** - Automated dependency updates

## 🔍 VS Code Configuration

Located in `.vscode/`:

- **`settings.json`** - Workspace settings and editor configuration
- **`extensions.json`** - Recommended extensions
- **`launch.json`** - Debug configurations

## 📚 Documentation

Located in `/docs/`:

- **`DEVOPS_CONFIG.md`** - Comprehensive DevOps and configuration guide
- **`CONTRIBUTING.md`** - Contribution guidelines and process
- **`CODE_OF_CONDUCT.md`** - Community code of conduct

### Root Level

- **`CONFIG_ENHANCEMENTS_SUMMARY.md`** - This enhancement summary
- **`CONFIGURATION_INDEX.md`** - This file

## 📊 File Organization

```
mirage-media-scape/
├── .editorconfig                    # Editor settings
├── .npmrc                           # NPM config
├── .nvmrc                           # Node version
├── .gitignore                       # Git ignore (enhanced)
├── .gitattributes                   # Git attributes
├── .prettierrc                      # Prettier config
├── .prettierignore                  # Prettier ignore
├── .env.example                     # Root env template
├── .pre-commit-config.yaml          # Pre-commit hooks
├── commitlint.config.ts             # Commitlint config
├── renovate.json                    # Renovate config
├── security.yaml                    # Security config
├── sonar-project.properties         # SonarQube config
├── .dockerlintrc.json               # Docker linting
├── .jestrc.json                     # Jest config
├── CONFIG_ENHANCEMENTS_SUMMARY.md   # This summary
│
├── .husky/                          # Git hooks
│   ├── pre-commit                   # Pre-commit hook
│   ├── commit-msg                   # Commit message hook
│   ├── pre-push                     # Pre-push hook
│   └── prepare-commit-msg           # Message prep hook
│
├── .github/
│   ├── workflows/
│   │   ├── main.yml                 # Main CI/CD pipeline (enhanced)
│   │   └── codeql.yml               # CodeQL security scan
│   └── dependabot.yml               # Dependabot config
│
├── .vscode/
│   ├── settings.json                # VS Code settings
│   ├── extensions.json              # Recommended extensions
│   └── launch.json                  # Debug configurations
│
├── frontend/
│   ├── .env.example                 # Frontend env template
│   ├── eslint.config.js             # ESLint config
│   └── .stylelintrc.json            # Stylelint config
│
├── server/
│   ├── .env.example                 # Server env template
│   ├── eslint.config.js             # ESLint config
│   └── .lintstagedrc.json           # Lint-staged config
│
└── docs/
    ├── DEVOPS_CONFIG.md             # DevOps guide
    ├── CONTRIBUTING.md              # Contributing guide
    └── CODE_OF_CONDUCT.md           # Code of conduct
```

## 🚀 Quick Start Commands

```bash
# Use correct Node version
nvm use

# Install dependencies
npm install
cd frontend && npm install && cd ..
cd server && npm install && cd ..

# Setup environment
cp .env.example .env
cp frontend/.env.example frontend/.env.local
cp server/.env.example server/.env

# Verify hooks are executable
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
chmod +x .husky/pre-push
chmod +x .husky/prepare-commit-msg

# Run quality checks
npm run lint
npm run type-check
npm run format

# Commit (with hooks)
git add .
git commit -m "feat: your message"

# Push (with pre-push tests)
git push origin feature-branch
```

## 📖 Documentation Guide

| Document                         | Purpose                      |
| -------------------------------- | ---------------------------- |
| `CONFIG_ENHANCEMENTS_SUMMARY.md` | Overview of all enhancements |
| `CONFIGURATION_INDEX.md`         | This file - quick reference  |
| `docs/DEVOPS_CONFIG.md`          | Detailed DevOps setup guide  |
| `docs/CONTRIBUTING.md`           | How to contribute            |
| `docs/CODE_OF_CONDUCT.md`        | Community standards          |

## 🔗 Key Links

- **EditorConfig Spec**: https://editorconfig.org/
- **Prettier Docs**: https://prettier.io/
- **ESLint Docs**: https://eslint.org/
- **Conventional Commits**: https://www.conventionalcommits.org/
- **Husky Docs**: https://typicode.github.io/husky/
- **GitHub Actions**: https://docs.github.com/en/actions
- **SonarQube**: https://www.sonarqube.org/

## ✅ What's Configured

- ✨ Code formatting (Prettier)
- 🔍 Code linting (ESLint, Stylelint)
- 📝 Commit validation (Commitlint)
- 🧪 Testing framework (Jest)
- 🤖 Git hooks (Husky)
- 🔐 Security scanning (CodeQL, Snyk)
- 📦 Dependency updates (Renovate, Dependabot)
- 🚀 CI/CD pipeline (GitHub Actions)
- 📚 Documentation (Guides and standards)
- 🛠️ IDE setup (VS Code)
- 🌍 Environment management (Templates)

## 🎯 Next Steps

1. Review `CONFIG_ENHANCEMENTS_SUMMARY.md`
2. Read `docs/DEVOPS_CONFIG.md` for detailed setup
3. Review `docs/CONTRIBUTING.md` for workflow
4. Ensure Husky hooks are executable
5. Run quality checks locally
6. Push and verify CI/CD pipeline

## 📞 Need Help?

- Check `docs/DEVOPS_CONFIG.md` for detailed guides
- Review `docs/CONTRIBUTING.md` for common issues
- See individual configuration file comments for specific settings
- Check GitHub Issues for known problems
