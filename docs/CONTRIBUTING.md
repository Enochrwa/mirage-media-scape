# Contributing Guidelines

Thank you for your interest in contributing to Mirage Media Scape! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please read and adhere to our [Code of Conduct](./CODE_OF_CONDUCT.md).

### Expected Behavior

- Be respectful and inclusive
- Welcome different viewpoints and experiences
- Focus on constructive criticism
- Respect confidentiality

## Getting Started

### Prerequisites

- Node.js 20.14.0+
- npm 10+
- Git
- Familiarity with TypeScript, React, and Node.js

### Fork and Clone

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/mirage-media-scape.git

# Add upstream remote
git remote add upstream https://github.com/Enochrwa/mirage-media-scape.git
```

### Setup Development Environment

```bash
# Use correct Node version
nvm use

# Install dependencies
npm install

# Install frontend dependencies
cd frontend && npm install

# Install server dependencies
cd ../server && npm install

# Enable git hooks
cd ../frontend && npx husky install

# Setup environment files
cp .env.example .env
cp frontend/.env.example frontend/.env.local
cp server/.env.example server/.env
```

## Development Workflow

### Create a Feature Branch

```bash
# Update main branch
git fetch upstream
git checkout main
git reset --hard upstream/main

# Create feature branch
git checkout -b feat/your-feature-name
```

### Branch Naming Convention

- `feat/feature-name` - New features
- `fix/bug-name` - Bug fixes
- `chore/task-name` - Chores
- `docs/doc-name` - Documentation
- `refactor/refactor-name` - Refactoring

### Make Changes

```bash
# Make your changes
# Test locally
npm test

# Code quality checks
npm run lint
npm run type-check
npm run format:check
```

### Keep Branch Updated

```bash
# Fetch latest changes
git fetch upstream

# Rebase on main
git rebase upstream/main

# Handle any conflicts and continue
```

## Coding Standards

### TypeScript

- Use strict mode
- Add type annotations for function parameters and returns
- Avoid `any` type unless absolutely necessary
- Use interfaces for object shapes

```typescript
// Good
interface User {
  id: string;
  name: string;
  email: string;
}

function getUser(id: string): Promise<User> {
  // implementation
}

// Avoid
function getUser(id: any): any {
  // implementation
}
```

### React Components

- Use functional components with hooks
- Keep components small and focused
- Use descriptive component names
- Add JSDoc comments for complex components

```typescript
/**
 * Component for displaying user profile
 * @param userId - The ID of the user to display
 * @returns The user profile component
 */
export interface UserProfileProps {
  userId: string;
}

export function UserProfile({ userId }: UserProfileProps) {
  // implementation
}
```

### Formatting

- Use Prettier for automatic formatting
- ESLint configuration will catch issues
- Run `npm run format` before committing

### Naming Conventions

```typescript
// Constants
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;

// Variables
let currentIndex = 0;
const userData = fetchUser();

// Functions
function calculateTotal(): number {}
async function fetchUserData(): Promise<User> {}

// Classes
class UserService {}
interface UserData {}
type UserState = 'active' | 'inactive';
```

## Commit Guidelines

### Conventional Commits

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

Must be one of:
- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect code meaning (formatting, whitespace)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Code improvement that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to build process, dependencies, or auxiliary tools
- **ci**: Changes to CI configuration files and scripts
- **build**: Changes to the build system or external dependencies
- **revert**: Revert a previous commit

### Scope

Optional. Examples:
- `feat(auth): add login functionality`
- `fix(player): resolve audio sync issue`
- `docs(api): update endpoint documentation`
- `chore(deps): update typescript dependency`

### Subject

- Use imperative mood ("add" not "added" or "adds")
- Do not capitalize first letter
- Do not use period at the end
- Limit to 50 characters
- Be specific and descriptive

### Body

Optional but recommended:
- Explain what and why, not how
- Wrap at 72 characters
- Add blank line before body
- Reference issues: "Fixes #123"

### Examples

```
feat(player): add spatial audio controls

Add new spatial audio control interface allowing users to adjust
audio positioning in 3D space. Implements HRTF processing for
immersive audio experience.

Fixes #234
```

```
fix(scanner): handle corrupted media files gracefully

Previously, the scanner would crash when encountering corrupted
media files. Now it logs the error and continues processing.

Fixes #512
```

## Pull Request Process

### Before Submitting

1. **Update your branch**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks**
   ```bash
   npm run lint
   npm run type-check
   npm run format
   npm test
   ```

3. **Ensure commits are clean**
   - Use `git rebase -i` to squash commits if needed
   - Each commit should be atomic and meaningful

### Submission

1. **Push to your fork**
   ```bash
   git push origin feat/your-feature-name
   ```

2. **Create Pull Request**
   - Go to GitHub and create a PR to `upstream/main`
   - Fill out the PR template completely
   - Add descriptive title and description
   - Link related issues

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Checklist
- [ ] Code follows project style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Changes reviewed for security issues

## Related Issues
Fixes #(issue number)
```

### Review Process

1. **Automated checks**
   - CI/CD pipeline runs automatically
   - All checks must pass

2. **Code review**
   - At least one maintainer review required
   - Address review comments

3. **Merge**
   - Squash commits into single commit (maintainer does)
   - Delete branch after merge

## Testing

### Test Structure

```
tests/
├── unit/
│   ├── services/
│   └── utils/
└── integration/
    ├── api/
    └── database/
```

### Writing Tests

```typescript
describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
  });

  describe('getUser', () => {
    it('should return user when found', async () => {
      const user = await service.getUser('123');
      expect(user.id).toBe('123');
    });

    it('should throw when user not found', async () => {
      await expect(service.getUser('invalid')).rejects.toThrow();
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/services/UserService.test.ts

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Coverage Requirements

- Minimum 80% line coverage
- Minimum 80% branch coverage
- Minimum 80% function coverage
- Minimum 80% statement coverage

## Documentation

### Code Comments

```typescript
/**
 * Calculates the sum of two numbers
 * @param a - First number
 * @param b - Second number
 * @returns The sum of a and b
 * @throws Error if inputs are not numbers
 */
function sum(a: number, b: number): number {
  return a + b;
}

// Use inline comments sparingly for complex logic
// This regex matches email addresses (RFC 5322 simplified)
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

### Documentation Files

- Update [DEVOPS_CONFIG.md](/DEVOPS_CONFIG.md) for DevOps changes
- Update [IMPLEMENTATION_GUIDE.md](/docs/IMPLEMENTATION_GUIDE.md) for features
- Update root [README.md](/README.md) for major changes
- Add migration guides for breaking changes

### Changelog

Add entry to relevant section:
- **Added** - New features
- **Changed** - Changes to existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security issues

## Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [TypeScript Handbook](https://www.typescripthandbook.org/)
- [React Documentation](https://react.dev/)
- [Jest Testing Library](https://jestjs.io/)
- [ESLint Rules](https://eslint.org/docs/rules/)

## Questions?

- Check [GitHub Issues](https://github.com/Enochrwa/mirage-media-scape/issues)
- Review existing documentation
- Ask in discussion threads

Thank you for contributing! 🎉
