# Claude Command: Review AI Feedback

Analyzes and prioritizes feedback from AI reviewers (Copilot, Gemini, etc.) on pull requests, filtering out resolved comments.

## Usage

```
/review-ai-feedback [PR-NUMBER]
```

If no PR number is provided, follow the automatic detection steps below.

## Resolution Detection
The command uses heuristics to detect likely resolved comments:
- Comments with replies from non-AI users containing keywords: `fixed`, `done`, `resolved`, `addressed`, `implemented`
- Comments marked as "resolved" in GitHub's review thread system (when using GraphQL)
- Human replies that acknowledge the fix

## Supported AI Reviewers
- `copilot` (GitHub Copilot)
- `gemini` (Gemini Code Assist)
- `coderabbit` (CodeRabbit AI)
- `sonar` (SonarQube/SonarCloud bots)

## Step-by-Step Execution

The review process has been automated in a script. Run the following command from the project root:

### Quick Usage
```bash
# Review current branch's PR (auto-detects PR number)
.claude/scripts/review-ai-feedback.sh

# Review specific PR
.claude/scripts/review-ai-feedback.sh 123
```

### Script Location
The script is located at: `.claude/scripts/review-ai-feedback.sh`

### What the Script Does
1. **Detects Current Branch** - Gets the current Git branch
2. **Finds PR Number** - Automatically finds the PR for current branch (or uses provided number)
3. **Gets Repository Info** - Extracts owner and repository name
4. **Gets Pull Request Node ID** - Fetches the GraphQL node ID for the PR
5. **Fetches Unresolved AI Comments** - Uses GraphQL to retrieve only unresolved review threads from AI reviewers
6. **Analyzes Priority** - Categorizes comments by priority level
7. **Generates Action Plan** - Provides next steps and quick commands

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

### Export All Comments (including resolved)
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
*Note: Only showing unresolved comments*

### 🔴 High Priority
1. **Issue**: Description
   - File: `path/to/file:line`
   - Fix: Action to take
   - Status: Unresolved

### 🟡 Medium Priority  
1. **Issue**: Description
   - File: `path/to/file:line`
   - Fix: Action to take
   - Status: Unresolved

### 🟢 Low Priority
1. **Issue**: Description
   - File: `path/to/file:line`
   - Consider: Optional improvement
   - Status: Unresolved
```

## Important Note for AI Assistants

**⚠️ After presenting the action plan, DO NOT automatically implement fixes or make changes.**

Wait for explicit instructions from the user before:
- Modifying any files
- Implementing suggested fixes
- Creating new files or commits
- Running any commands that change the codebase

The user needs time to:
1. Review the prioritized feedback
2. Decide which items to address
3. Determine the implementation approach
4. Consider project-specific constraints

Always ask for confirmation or wait for specific instructions like:
- "Please fix the high priority issues"
- "Implement the transaction wrapper suggestion"
- "Skip the low priority items for now"