# Commit Convention

This project follows the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification with [Gitmoji](https://gitmoji.dev/) for visual clarity.

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
| `style` | 💄 | Code style/formatting | `💄 style(web): format with biome` |
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

When analyzing changes, consider splitting commits based on these criteria:

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
🔧 chore(biome): add custom rules for imports
🚑 hotfix(api): prevent crash when question has no options
```

### Bad Examples ❌
```
update code                    # Too vague
Fixed bug                      # Missing type and emoji
✨ Added new feature          # Not imperative mood
feat: ADDED QUIZ TIMER        # All caps
✨ feat: implemented the entire quiz system with all the features # Too long
```

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

## Best Practices

- **Atomic commits**: Each commit should contain related changes that serve a single purpose
- **Present tense, imperative mood**: Write commit messages as commands (e.g., "add feature" not "added feature")
- **Concise first line**: Keep the first line under 50 characters
- **Detailed body when needed**: Explain the why and the context, not just the what
- **Link to issues**: Reference related issues in the footer

## VSCode Integration

Install the "Conventional Commits" extension for assisted commit message creation.

## Git Hooks

Consider using these tools to enforce conventions:
- [commitlint](https://commitlint.js.org/) - Lint commit messages
- [husky](https://typicode.github.io/husky/) - Git hooks
- [commitizen](https://github.com/commitizen/cz-cli) - Interactive commit helper