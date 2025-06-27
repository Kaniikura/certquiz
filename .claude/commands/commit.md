# Claude Command: Commit

This command helps you create well-formatted commits following the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification with [Gitmoji](https://gitmoji.dev/) for visual clarity.

## Usage

To create a commit, just type:
```
/commit
```

Or with options:
```
/commit --no-verify
```

## What This Command Does

1. Unless specified with `--no-verify`, automatically runs pre-commit checks:
   - `pnpm lint` to ensure code quality
   - `pnpm build` to verify the build succeeds
   - `pnpm generate:docs` to update documentation
2. Checks which files are staged with `git status`
3. If 0 files are staged, automatically adds all modified and new files with `git add`
4. Performs a `git diff` to understand what changes are being committed
5. Analyzes the diff to determine if multiple distinct logical changes are present
6. If multiple distinct changes are detected, suggests breaking the commit into multiple smaller commits
7. For each commit (or the single commit if not split), creates a commit message using emoji conventional commit format

## Commit Message Format

```
<emoji> <type>(<scope>): <subject>

<body>

<footer>
```

### Example
```
✨ feat(quiz): add timer functionality for quiz sessions

- Add countdown timer component
- Store timer state in session
- Auto-submit when time expires

Closes #42
```

## Type and Emoji Mapping

### Core Types (from Conventional Commits)
| Type | Emoji | Description | Example |
|------|-------|-------------|---------|
| `feat` | ✨ | New feature | `✨ feat(auth): add OAuth2 login` |
| `fix` | 🐛 | Bug fix | `🐛 fix(quiz): correct answer validation logic` |
| `docs` | 📝 | Documentation only | `📝 docs(api): update endpoint documentation` |
| `style` | 💄 | Code style/formatting | `💄 style(web): format with prettier` |
| `refactor` | ♻️ | Code refactoring | `♻️ refactor(db): simplify query builder` |
| `perf` | ⚡️ | Performance improvement | `⚡️ perf(api): optimize question queries` |
| `test` | ✅ | Add/update tests | `✅ test(quiz): add integration tests` |
| `build` | 📦 | Build system/dependencies | `📦 build(deps): update SvelteKit to v2` |
| `ci` | 👷 | CI/CD changes | `👷 ci(github): add test workflow` |
| `chore` | 🔧 | Other changes | `🔧 chore(config): update tsconfig` |
| `revert` | ⏪ | Revert previous commit | `⏪ revert: feat(quiz): remove timer` |
| `wip` | 🚧 | Work in progress | `🚧 wip(admin): partial question import` |
| `init` | 🎉 | Initial commit/project setup | `🎉 init: setup monorepo structure` |
| `security` | 🔒 | Security fixes | `🔒 security(auth): patch JWT vulnerability` |
| `docker` | 🐳 | Docker related | `🐳 docker(api): optimize image size` |
| `deploy` | 🚀 | Deployment related | `🚀 deploy(k8s): update ingress config` |
| `hotfix` | 🚑 | Critical hotfix | `🚑 hotfix(quiz): fix crash on submit` |
| `merge` | 🔀 | Merge branches | `🔀 merge: branch 'feature/quiz-timer'` |
| `breaking` | 💥 | Breaking changes | `💥 feat(api)!: change auth flow` |

### Extended Emoji Mappings
| Type | Emoji | Description |
|------|-------|-------------|
| `test` | 🧪 | Add a failing test |
| `fix` | 🚨 | Fix compiler/linter warnings |
| `fix` | 🔒️ | Fix security issues |
| `chore` | 👥 | Add or update contributors |
| `refactor` | 🚚 | Move or rename resources |
| `refactor` | 🏗️ | Make architectural changes |
| `chore` | 🔀 | Merge branches |
| `chore` | 📦️ | Add or update compiled files or packages |
| `chore` | ➕ | Add a dependency |
| `chore` | ➖ | Remove a dependency |
| `chore` | 🌱 | Add or update seed files |
| `chore` | 🧑‍💻 | Improve developer experience |
| `feat` | 🧵 | Add or update code related to multithreading or concurrency |
| `feat` | 🔍️ | Improve SEO |
| `feat` | 🏷️ | Add or update types |
| `feat` | 💬 | Add or update text and literals |
| `feat` | 🌐 | Internationalization and localization |
| `feat` | 👔 | Add or update business logic |
| `feat` | 📱 | Work on responsive design |
| `feat` | 🚸 | Improve user experience / usability |
| `fix` | 🩹 | Simple fix for a non-critical issue |
| `fix` | 🥅 | Catch errors |
| `fix` | 👽️ | Update code due to external API changes |
| `fix` | 🔥 | Remove code or files |
| `style` | 🎨 | Improve structure/format of the code |
| `fix` | 🚑️ | Critical hotfix |
| `chore` | 🎉 | Begin a project |
| `chore` | 🔖 | Release/Version tags |
| `wip` | 🚧 | Work in progress |
| `fix` | 💚 | Fix CI build |
| `chore` | 📌 | Pin dependencies to specific versions |
| `ci` | 👷 | Add or update CI build system |
| `feat` | 📈 | Add or update analytics or tracking code |
| `fix` | ✏️ | Fix typos |
| `revert` | ⏪️ | Revert changes |
| `chore` | 📄 | Add or update license |
| `feat` | 💥 | Introduce breaking changes |
| `assets` | 🍱 | Add or update assets |
| `feat` | ♿️ | Improve accessibility |
| `docs` | 💡 | Add or update comments in source code |
| `db` | 🗃️ | Perform database related changes |
| `feat` | 🔊 | Add or update logs |
| `fix` | 🔇 | Remove logs |
| `test` | 🤡 | Mock things |
| `feat` | 🥚 | Add or update an easter egg |
| `chore` | 🙈 | Add or update .gitignore file |
| `test` | 📸 | Add or update snapshots |
| `experiment` | ⚗️ | Perform experiments |
| `feat` | 🚩 | Add, update, or remove feature flags |
| `ui` | 💫 | Add or update animations and transitions |
| `refactor` | ⚰️ | Remove dead code |
| `feat` | 🦺 | Add or update code related to validation |
| `feat` | ✈️ | Improve offline support |

## Scope Guidelines

Use specific scopes related to the project structure:

### Frontend Scopes
- `web` - General frontend changes
- `ui` - UI components
- `auth` - Authentication UI
- `quiz` - Quiz interface
- `admin` - Admin interface

### Backend Scopes
- `api` - General API changes
- `db` - Database/Drizzle ORM
- `auth` - Authentication backend
- `quiz` - Quiz logic
- `typespec` - API specifications

### Other Scopes
- `shared` - Shared packages
- `docker` - Docker configuration
- `k8s` - Kubernetes manifests
- `deps` - Dependencies
- `config` - Configuration files

## Commit Message Rules

### 1. Subject Line
- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter
- No period at the end
- Maximum 50 characters

### 2. Body (Optional)
- Wrap at 72 characters
- Explain **what** and **why**, not how
- Separate from subject with blank line
- Use bullet points for multiple items

### 3. Footer (Optional)
- Reference issues: `Closes #123`, `Fixes #456`
- Breaking changes: Start with `BREAKING CHANGE:`
- Co-authors: `Co-authored-by: Name <email>`

## Project-Specific Rules

### 1. **TDD Commits**
When implementing features with TDD, use this pattern:
```
✅ test(scope): add failing tests for [feature]
✨ feat(scope): implement [feature] to pass tests
♻️ refactor(scope): improve [feature] implementation
```

### 2. **Schema Changes**
Database or API schema changes require special attention:
```
📝 docs(typespec): define [endpoint] schema
♻️ refactor(db): add migration for [table/column]
```

### 3. **Multi-Language Changes**
When changes affect both frontend and backend:
```
✨ feat(web,api): implement quiz timer feature
```

### 4. **Dependency Updates**
Be specific about what and why:
```
📦 build(deps): upgrade drizzle-orm to v0.29.0

- Fixes TypeScript 5.3 compatibility
- Adds support for new PostgreSQL features
```

### 5. **Performance Commits**
Include metrics when possible:
```
⚡️ perf(api): optimize question loading

- Reduce query time from 200ms to 50ms
- Add database indexes for exam_type and category
```

## Guidelines for Splitting Commits

When analyzing the diff, consider splitting commits based on these criteria:

1. **Different concerns**: Changes to unrelated parts of the codebase
2. **Different types of changes**: Mixing features, fixes, refactoring, etc.
3. **File patterns**: Changes to different types of files (e.g., source code vs documentation)
4. **Logical grouping**: Changes that would be easier to understand or review separately
5. **Size**: Very large changes that would be clearer if broken down

## Commit Message Examples

### Good Examples ✅
```
✨ feat(quiz): add progress tracking during quiz session
🐛 fix(auth): correct JWT token expiration handling
📝 docs(api): add examples for quiz endpoints
♻️ refactor(db): extract common query patterns
⚡️ perf(web): lazy load admin components
✅ test(quiz): add edge cases for answer validation
🔧 chore(eslint): add custom rules for imports
🚑 hotfix(api): prevent crash when question has no options
🎨 style: reorganize component structure for better readability
🔥 fix: remove deprecated legacy code
🦺 feat: add input validation for user registration form
💚 fix: resolve failing CI pipeline tests
📈 feat: implement analytics tracking for user engagement
🔒️ fix: strengthen authentication password requirements
♿️ feat: improve form accessibility for screen readers
🧑‍💻 chore: improve developer tooling setup process
👔 feat: implement business logic for transaction validation
🩹 fix: address minor styling inconsistency in header
```

### Bad Examples ❌
```
update code                    # Too vague
Fixed bug                      # Missing type and emoji
✨ Added new feature          # Not imperative mood
feat: ADDED QUIZ TIMER        # All caps
✨ feat: implemented the entire quiz system with all the features # Too long
```

### Example of Splitting Commits
- First commit: ✨ feat: add new solc version type definitions
- Second commit: 📝 docs: update documentation for new solc versions
- Third commit: 🔧 chore: update package.json dependencies
- Fourth commit: 🏷️ feat: add type definitions for new API endpoints
- Fifth commit: 🧵 feat: improve concurrency handling in worker threads
- Sixth commit: 🚨 fix: resolve linting issues in new code
- Seventh commit: ✅ test: add unit tests for new solc version features
- Eighth commit: 🔒️ fix: update dependencies with security vulnerabilities

## Command Options

- `--no-verify`: Skip running the pre-commit checks (lint, build, generate:docs)

## Important Notes

- By default, pre-commit checks (`pnpm lint`, `pnpm build`, `pnpm generate:docs`) will run to ensure code quality
- If these checks fail, you'll be asked if you want to proceed with the commit anyway or fix the issues first
- If specific files are already staged, the command will only commit those files
- If no files are staged, it will automatically stage all modified and new files
- The commit message will be constructed based on the changes detected
- Before committing, the command will review the diff to identify if multiple commits would be more appropriate
- If suggesting multiple commits, it will help you stage and commit the changes separately
- Always reviews the commit diff to ensure the message matches the changes

## Best Practices for Commits

- **Verify before committing**: Ensure code is linted, builds correctly, and documentation is updated
- **Atomic commits**: Each commit should contain related changes that serve a single purpose
- **Split large changes**: If changes touch multiple concerns, split them into separate commits
- **Present tense, imperative mood**: Write commit messages as commands (e.g., "add feature" not "added feature")
- **Concise first line**: Keep the first line under 50 characters

## Git Hooks

Consider using these tools to enforce conventions:
- [commitlint](https://commitlint.js.org/) - Lint commit messages
- [husky](https://typicode.github.io/husky/) - Git hooks
- [commitizen](https://github.com/commitizen/cz-cli) - Interactive commit helper

## VSCode Integration

Install the "Conventional Commits" extension for assisted commit message creation.

## Quick Reference

```bash
# Feature
git commit -m "✨ feat(quiz): add question bookmarking"

# Bug fix
git commit -m "🐛 fix(api): handle null user in progress update"

# Refactor with TDD
git commit -m "♻️ refactor(quiz): simplify answer validation logic

- Extract validation to pure function
- Add comprehensive test coverage
- Remove duplicate code"

# Breaking change
git commit -m "💥 feat(api)!: change question API response format

BREAKING CHANGE: options are now nested under 'choices' key"
```