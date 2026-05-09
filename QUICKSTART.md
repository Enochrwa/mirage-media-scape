# Quick Start Guide

Fast setup for the Mirage Media Scape development environment with all new configurations.

## ⚡ 5-Minute Setup

### 1. Verify Node.js Version (1 min)

```bash
# Check and use correct Node version
nvm use

# Verify it's 20.14.0 or compatible
node --version
```

### 2. Install Dependencies (2 min)

```bash
# Root dependencies
npm install

# Frontend
cd frontend && npm install && cd ..

# Server
cd server && npm install && cd ..
```

### 3. Setup Environment Files (1 min)

```bash
# Root
cp .env.example .env

# Frontend
cd frontend && cp .env.example .env.local && cd ..

# Server
cd server && cp .env.example .env && cd ..
```

### 4. Test Git Hooks (1 min)

```bash
# Make a test commit
git add .
git commit -m "chore: initialize project with configurations"
```

**Done!** ✅ All git hooks are now active.

---

## 🔍 Common Commands

### Code Quality

```bash
# Frontend
cd frontend

# Format code
npm run format

# Check formatting
npm run format:check

# Lint
npm run lint

# Fix linting issues
npm run lint:fix

# Type check
npm run type-check

# All checks
npm run check
```

### Testing

```bash
# Server
cd server

# Run tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Building

```bash
# Frontend
cd frontend && npm run build && cd ..

# Server
cd server && npm run build && cd ..

# Both
npm run build
```

---

## 📝 Git Workflow

### Create Feature Branch

```bash
git checkout -b feat/feature-name
```

### Commit Changes

```bash
# Stage changes
git add .

# Commit (hooks will validate format and auto-fix)
git commit -m "feat(scope): description"

# Accepted types: feat, fix, docs, style, refactor, perf, test, chore, ci, build
```

### Push to Remote

```bash
# Pre-push hook will run tests
git push origin feat/feature-name
```

---

## 🐛 Troubleshooting

### Hooks Not Running?

```bash
# Make executable
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
chmod +x .husky/pre-push
chmod +x .husky/prepare-commit-msg
```

### Need to Skip Hooks?

```bash
# Skip pre-commit
git commit -m "message" --no-verify

# Skip pre-push
git push --no-verify

# ⚠️ Use with caution - hooks ensure quality!
```

### ESLint Cache Issues?

```bash
rm -rf .eslintcache
rm -rf frontend/.eslintcache
rm -rf server/.eslintcache
npm run lint
```

### Node Version Wrong?

```bash
# Install correct version
nvm install 20.14.0

# Use it
nvm use 20.14.0

# Verify
node --version  # Should be v20.14.0
```

---

## 📖 Documentation Map

| Need | Read |
|------|------|
| Quick overview | `COMPLETION_CHECKLIST.md` |
| File reference | `CONFIGURATION_INDEX.md` |
| Detailed setup | `docs/DEVOPS_CONFIG.md` |
| How to contribute | `docs/CONTRIBUTING.md` |
| Community rules | `docs/CODE_OF_CONDUCT.md` |

---

## ✨ What's Working Now

### Before Commit
- ✅ Prettier formats your code
- ✅ ESLint fixes issues automatically
- ✅ Type checking validates TypeScript
- ✅ Stylelint checks CSS (frontend)

### Before Push
- ✅ Jest runs all tests
- ✅ Coverage is checked (80% minimum)
- ✅ Failed tests block push

### On Pull Request
- ✅ GitHub Actions runs quality checks
- ✅ Tests run on multiple Node versions
- ✅ Coverage reports are generated
- ✅ Security scanning checks for vulnerabilities

---

## 🎯 First Commit Example

```bash
# 1. Make changes
echo "console.log('hello')" > test.js

# 2. Stage changes
git add test.js

# 3. Commit (hooks run automatically)
git commit -m "feat(test): add hello world"
# 
# Output:
# 🔍 Running pre-commit checks...
# ✓ Checking frontend code style...
# ✓ Checking server code style...
# ✓ Adding formatted files back to staging...
# ✅ Pre-commit checks passed!

# 4. Push (tests run automatically)
git push origin feat/test
#
# Output:
# 🧪 Running pre-push checks...
# ✅ All checks passed! Ready to push.
```

---

## 🚀 CI/CD Pipeline Status

Visit your pull request on GitHub to see:
- ✅ Quality checks (lint, type, format)
- ✅ Build status (frontend, server)
- ✅ Test results (coverage, jest)
- ✅ Security scan (CodeQL)

---

## 💡 Pro Tips

1. **Auto-fix everything**: Run `npm run format` then `npm run lint:fix` before pushing

2. **Conventional commits** make it easy:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `refactor:` for code cleanup

3. **Check before committing**:
   ```bash
   npm run lint
   npm run type-check
   npm run format:check
   ```

4. **View all config files**: See `CONFIGURATION_INDEX.md`

5. **Need help?** Check `docs/DEVOPS_CONFIG.md` Troubleshooting section

---

## ✅ Success Checklist

- [ ] Node.js 20.14.0 installed (run `nvm use`)
- [ ] Dependencies installed (all 3 directories)
- [ ] Environment files created (.env.example copied)
- [ ] Git hooks executable (chmod +x .husky/*)
- [ ] First commit made successfully
- [ ] No lint errors on commit
- [ ] Tests passed (if applicable)
- [ ] Documentation reviewed

**All set!** 🎉 You're ready to contribute to Mirage Media Scape!

---

## 📞 Questions?

- **Setup issues**: `docs/DEVOPS_CONFIG.md` → Troubleshooting
- **Contributing**: `docs/CONTRIBUTING.md`
- **Code of Conduct**: `docs/CODE_OF_CONDUCT.md`
- **All configs**: `CONFIGURATION_INDEX.md`
