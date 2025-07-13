# Claude Command: Review AI Feedback

Analyzes and prioritizes feedback from AI reviewers (Copilot, Gemini, etc.) on pull requests, filtering out resolved comments.

## Usage

```
/review-ai-feedback [PR-NUMBER]
```

## 🚨 EXECUTION REQUIREMENT

**ALWAYS execute the provided script first:**

```bash
# Execute the automation script (auto-detects PR)
.claude/scripts/review-ai-feedback.sh

# Or for specific PR number
.claude/scripts/review-ai-feedback.sh 123
```

**The script handles all data collection automatically. Use its output for analysis.**

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

## ⚡ MANDATORY FIRST STEP

**Execute the automation script - this is the ONLY way to collect AI feedback:**

```bash
# From project root directory
.claude/scripts/review-ai-feedback.sh
```

### Script Process
1. **Detects Current Branch** - Gets the current Git branch
2. **Finds PR Number** - Automatically finds the PR for current branch (or uses provided number)
3. **Gets Repository Info** - Extracts owner and repository name
4. **Gets Pull Request Node ID** - Fetches the GraphQL node ID for the PR
5. **Fetches Unresolved AI Comments** - Uses GraphQL to retrieve only unresolved review threads from AI reviewers
6. **Analyzes Priority** - Categorizes comments by priority level
7. **Generates Action Plan** - Provides next steps and quick commands

### Script Output
The script provides formatted analysis ready for review. Work with this output, not raw data.

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


## Script Execution Guide

### Standard Usage
```bash
# Execute from project root
.claude/scripts/review-ai-feedback.sh
```

### With Specific PR Number
```bash
# When PR auto-detection fails
.claude/scripts/review-ai-feedback.sh 123
```

### Script Requirements
- Must be run from project root directory
- Requires `gh` CLI to be authenticated
- Produces formatted output for immediate analysis

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

## 🤖 Instructions for AI Assistants

### STEP 1: Execute Data Collection Script
**FIRST and ONLY action - run the automation script:**

```bash
.claude/scripts/review-ai-feedback.sh
```

**Use the script's output as your data source. The script handles all GitHub API calls.**

### STEP 2: Analyze Script Output
Parse the script's formatted output to identify:
- Unresolved AI feedback
- Priority classifications  
- Action items

### STEP 3: Present Analysis
Provide organized analysis based on script output.

### STEP 4: Wait for Instructions
**After presenting analysis, DO NOT automatically implement fixes.**

Wait for explicit user instructions before:
- Modifying any files
- Implementing suggested fixes
- Creating new files or commits

Always ask for confirmation like:
- "Please fix the high priority issues"
- "Implement the transaction wrapper suggestion"
- "Skip the low priority items for now"