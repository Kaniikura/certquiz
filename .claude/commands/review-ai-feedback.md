# Claude Command: Review AI Feedback

Analyzes and prioritizes feedback from AI reviewers (Copilot, Gemini, etc.) on pull requests.

## Usage

```
/review-ai-feedback [PR-NUMBER]
```

If no PR number is provided, follow the automatic detection steps below.

## Step-by-Step Execution

### Step 1: Get Current Branch
```bash
git branch --show-current
```

### Step 2: Find PR Number (if not provided)
```bash
gh pr list --head BRANCH_NAME --json number,title --jq '.[0]'
```

### Step 3: Get Repository Name
```bash
gh repo view --json nameWithOwner -q .nameWithOwner
```

### Step 4: Fetch AI Code Comments
```bash
gh api /repos/OWNER/REPO/pulls/PR_NUMBER/comments --jq 'map(select(.user.login | test("copilot|gemini|coderabbit|sonar"; "i"))) | .[] | "📍 \(.path):\(.line)\n\(.body | split("\n")[0:3] | join("\n"))\n"'
```

### Step 5: Get Review Summary
```bash
gh api /repos/OWNER/REPO/pulls/PR_NUMBER/reviews --jq 'map(select(.user.login | test("copilot|gemini|coderabbit|sonar"; "i"))) | group_by(.user.login) | map({user: .[0].user.login, count: length})'
```

### Step 6: Check General Comments
```bash
gh api /repos/OWNER/REPO/issues/PR_NUMBER/comments --jq 'map(select(.user.login | test("copilot|gemini|coderabbit|sonar"; "i"))) | .[] | "\(.user.login): \(.body | split("\n")[0:2] | join(" "))"'
```

## Optional Advanced Steps

### View Code Context (for specific comment)
```bash
gh api /repos/OWNER/REPO/pulls/PR_NUMBER/comments/COMMENT_ID --jq '.diff_hunk'
```

## Priority Classification

### 🔴 High Priority (Must Fix)
- Security vulnerabilities
- Breaking changes
- Data loss risks
- Critical bugs
- Keywords: `security`, `vulnerability`, `breaking`, `critical`, `![high]`

### 🟡 Medium Priority (Should Fix)
- Code quality issues
- Missing error handling
- Documentation gaps
- Suboptimal patterns
- Keywords: `error`, `missing`, `incomplete`, `![medium]`

### 🟢 Low Priority (Nice to Have)
- Style suggestions
- Minor optimizations
- Additional tests
- Future-proofing
- Keywords: `consider`, `style`, `optional`, `![low]`


## Quick Reference

### View PR with Comments
```bash
gh pr view --comments
```

### View Specific PR
```bash
gh pr view 123 --comments
```

### Export All Comments
```bash
gh api /repos/OWNER/REPO/pulls/123/comments > feedback.json
```

### Count Comments by Reviewer
```bash
gh api /repos/OWNER/REPO/pulls/123/comments --jq 'group_by(.user.login) | map({user: .[0].user.login, count: length})'
```

## Response Templates

### Accepting
```
Thank you! This is valid - I'll implement it.
```

### Deferring
```
Good suggestion. I'll track this for future implementation.
```

### Declining
```
Thanks, but this is intentional because [reason].
```

## Action Plan Format

```markdown
## AI Review Action Plan - PR #123

### 🔴 High Priority
1. **Issue**: Description
   - File: `path/to/file:line`
   - Fix: Action to take

### 🟡 Medium Priority  
1. **Issue**: Description
   - File: `path/to/file:line`
   - Fix: Action to take

### 🟢 Low Priority
1. **Issue**: Description
   - File: `path/to/file:line`
   - Consider: Optional improvement
```