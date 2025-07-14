# How to Create a Pull Request Using GitHub CLI

This guide explains how to create pull requests using GitHub CLI in our project, with our specialized templates for Backend, Frontend, and Other changes.

## Choosing the Right Template

We have three specialized PR templates:

- **Backend** (`.github/pull_request_template/backend.md`): API, database, services
- **Frontend** (`.github/pull_request_template/frontend.md`): UI, components, styling  
- **Other** (`.github/pull_request_template/other.md`): Docs, config, CI/CD

## Creating a New Pull Request

### Method 1: Using Template Parameter (Recommended)

```bash
# For Backend changes
gh pr create --title "✨ feat(api): Add quiz endpoints" --web --template=backend.md

# For Frontend changes  
gh pr create --title "🎨 style(ui): Update quiz component" --web --template=frontend.md

# For Other changes
gh pr create --title "📝 docs: Update API documentation" --web --template=other.md
```

### Method 2: Using Template File

1. First, copy the appropriate template:

```bash
# Backend PR
cp .github/pull_request_template/backend.md pr-description.md

# Frontend PR
cp .github/pull_request_template/frontend.md pr-description.md

# Other PR
cp .github/pull_request_template/other.md pr-description.md
```

2. Edit the template file with your specific information

3. Create the PR:

```bash
gh pr create --title "✨ feat(scope): Your descriptive title" --body-file pr-description.md --base main --draft
```

### Method 3: Direct Template Content

For Backend PRs with minimal template:

```bash
gh pr create --title "✨ feat(api): Add user endpoints" --body "$(cat <<'EOF'
## 📋 Description
Added new user management endpoints with full CRUD operations.

### 🎯 Related Issue
Closes #123

### Test Evidence
\`\`\`bash
cd apps/api && bun run test --coverage
# Coverage: 85%
\`\`\`

### ✅ Backend Checklist
- [x] TDD followed: Tests written BEFORE implementation
- [x] Schema-first: TypeSpec schemas updated
- [x] Type safety: No any types used
- [x] Tests pass: bun run test
EOF
)" --base main --draft
```

## Best Practices

### 1. **PR Title Format**: Use conventional commit format with emojis

Common emojis and their usage:
- `✨ feat`: New feature
- `🐛 fix`: Bug fix
- `📝 docs`: Documentation
- `🎨 style`: UI/styling changes
- `♻️ refactor`: Code refactoring
- `✅ test`: Test updates
- `🔧 chore`: Maintenance tasks
- `⚡ perf`: Performance improvements

Examples:
- Backend: `✨ feat(api): Add question filtering endpoints`
- Frontend: `🎨 style(quiz): Improve mobile responsiveness`
- Other: `📝 docs(setup): Add Docker troubleshooting guide`

### 2. **Template Requirements**

**All PRs must include:**
- Evidence of TDD (tests written first)
- Test coverage report
- Type safety verification
- Clear description of changes

**Backend PRs must also include:**
- Schema updates (TypeSpec/Database)
- Migration testing evidence
- Performance metrics

**Frontend PRs must also include:**
- Screenshots (desktop & mobile)
- Accessibility verification
- Browser testing checklist

### 3. **Testing Evidence**

Always include actual test output:

```bash
# Backend
cd apps/api && bun run test --coverage

# Frontend
cd apps/web && bun run test --coverage
```

### 4. **Draft PRs**

Start as draft when work is in progress:
```bash
# Create as draft
gh pr create --title "WIP: ✨ feat(api): User management" --draft

# Convert to ready when complete
gh pr ready
```

## Common Mistakes to Avoid

1. **Wrong Template**: Using frontend template for backend changes
2. **No TDD Evidence**: Not showing tests were written first
3. **Missing Type Safety**: Using `any` types
4. **Incomplete Testing**: Not including coverage reports
5. **Poor Description**: Not explaining the "why" behind changes

## Additional GitHub CLI Commands

```bash
# List your open PRs
gh pr list --author "@me"

# Check PR status
gh pr status

# View a specific PR
gh pr view <PR-NUMBER>

# Check out a PR locally
gh pr checkout <PR-NUMBER>

# Add reviewers
gh pr edit <PR-NUMBER> --add-reviewer user1,user2

# Request specific template review
gh pr comment <PR-NUMBER> --body "Please review using backend template checklist"

# Merge PR (after approval)
gh pr merge <PR-NUMBER> --squash --delete-branch
```

## Quick Reference

### Backend PR Example
```bash
gh pr create \
  --title "✨ feat(api): Add quiz session management" \
  --body-file .github/pull_request_template/backend.md \
  --base main \
  --draft
```

### Frontend PR Example
```bash
gh pr create \
  --title "🎨 style(quiz): Improve question card design" \
  --body-file .github/pull_request_template/frontend.md \
  --base main \
  --draft
```

### Other PR Example
```bash
gh pr create \
  --title "📝 docs: Add API usage examples" \
  --body-file .github/pull_request_template/other.md \
  --base main
```

## Related Documentation

- [Backend PR Template](../../.github/pull_request_template/backend.md)
- [Frontend PR Template](../../.github/pull_request_template/frontend.md)
- [Other PR Template](../../.github/pull_request_template/other.md)
- [Commit Convention](../commit-convention.md)
- [GitHub CLI documentation](https://cli.github.com/manual/)