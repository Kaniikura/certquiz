#!/bin/bash

# Claude Script: Review AI Feedback
# Analyzes and prioritizes feedback from AI reviewers on pull requests

set -euo pipefail

# Function to print usage
usage() {
    echo "Usage: $0 [PR_NUMBER]"
    echo "  PR_NUMBER: Optional pull request number. If not provided, will detect from current branch."
    exit 1
}

# Function to print error messages
error() {
    echo "❌ Error: $1" >&2
    exit 1
}

# Function to print info messages
info() {
    echo "ℹ️  $1"
}

# Function to print section headers
section() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "▶️  $1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    error "GitHub CLI (gh) is not installed. Please install it first."
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    error "jq is not installed. Please install it first."
fi

# Parse arguments
PR_NUMBER=""
if [ $# -gt 1 ]; then
    usage
elif [ $# -eq 1 ]; then
    if [[ ! "$1" =~ ^[0-9]+$ ]]; then
        error "PR number must be a positive integer"
    fi
    PR_NUMBER="$1"
fi

section "Step 1: Getting Current Branch"
BRANCH=$(git branch --show-current)
info "Current branch: $BRANCH"

# If PR number not provided, detect from branch
if [ -z "$PR_NUMBER" ]; then
    section "Step 2: Finding PR Number"
    PR_NUMBER=$(gh pr list --head "$BRANCH" --json number -q '.[0].number' 2>/dev/null || echo "")
    
    if [ -z "$PR_NUMBER" ]; then
        error "No pull request found for branch '$BRANCH'. Please provide PR number as argument."
    fi
    info "Found PR #$PR_NUMBER"
else
    section "Step 2: Using Provided PR Number"
    info "Using PR #$PR_NUMBER"
fi

section "Step 3: Getting Repository Information"
REPO_INFO=$(gh repo view --json owner,name -q '"\(.owner.login)/\(.name)"')
info "Repository: $REPO_INFO"

# Split owner and repo
IFS='/' read -r OWNER REPO <<< "$REPO_INFO"

section "Step 4: Getting Pull Request Node ID"

# Get the node ID for GraphQL
PULL_REQUEST_ID=$(gh api "/repos/$OWNER/$REPO/pulls/$PR_NUMBER" --jq .node_id 2>/dev/null || echo "")

if [ -z "$PULL_REQUEST_ID" ]; then
    error "Failed to get pull request ID. Please check if PR #$PR_NUMBER exists."
fi

info "Pull request node ID: $PULL_REQUEST_ID"

section "Step 5: Fetching Unresolved AI Review Comments"

# Use GraphQL to fetch only unresolved comments
echo ""
info "Fetching unresolved review threads..."

UNRESOLVED_COMMENTS=$(gh api graphql -f pull_request_id="$PULL_REQUEST_ID" -F query='
query($pull_request_id: ID!) {
  node(id: $pull_request_id) {
    ... on PullRequest {
      reviewThreads(first: 100) {
        nodes {
          isResolved
          comments(first: 10) {
            nodes {
              author { login }
              body
              path
              line
            }
          }
        }
      }
    }
  }
}' 2>/dev/null | jq -r '
.data.node.reviewThreads.nodes[] as $thread |
select($thread.isResolved == false) |
select($thread.comments.nodes[0]?.author.login | test("copilot|gemini|coderabbit|sonar|cursor"; "i")) |
$thread.comments.nodes[0] as $comment |
"👤 Author: \($comment.author.login)
📄 File: \($comment.path)
#️⃣ Line: \($comment.line // "N/A")
🔴 Status: Unresolved
--------------------
\($comment.body)
===================="
' 2>/dev/null || echo "")

section "AI Review Comments Summary"

# Count unresolved comments
if [ -n "$UNRESOLVED_COMMENTS" ] && [ "$UNRESOLVED_COMMENTS" != "" ]; then
    UNRESOLVED_COUNT=$(echo "$UNRESOLVED_COMMENTS" | grep -c "^👤 Author:" || true)
else
    UNRESOLVED_COUNT=0
fi

info "Found $UNRESOLVED_COUNT unresolved AI review comments"

if [ "$UNRESOLVED_COUNT" -eq 0 ]; then
    echo ""
    echo "✅ No unresolved AI review comments found on PR #$PR_NUMBER"
    echo ""
    echo "ℹ️  Note: This only shows unresolved review threads."
    echo "   Comments may have been marked as resolved or addressed."
    exit 0
fi

# Display unresolved comments
section "Unresolved AI Review Comments"
echo "$UNRESOLVED_COMMENTS"

# Priority classification
section "Priority Analysis"

echo ""
echo "📊 Analyzing comment priorities..."
echo ""

# Function to analyze priority
analyze_priority() {
    local comments="$1"
    
    # High priority keywords
    HIGH_COUNT=$(echo "$comments" | grep -ciE "security|vulnerability|breaking|critical|unsafe|leak|injection|exposure" || echo 0)
    
    # Medium priority keywords  
    MEDIUM_COUNT=$(echo "$comments" | grep -ciE "error|missing|incomplete|bug|issue|problem|incorrect|wrong" || echo 0)
    
    # Low priority keywords
    LOW_COUNT=$(echo "$comments" | grep -ciE "consider|style|optional|suggestion|improvement|enhance|refactor" || echo 0)
    
    echo "  🔴 High Priority Issues: $HIGH_COUNT"
    echo "  🟡 Medium Priority Issues: $MEDIUM_COUNT"
    echo "  🟢 Low Priority Suggestions: $LOW_COUNT"
}

analyze_priority "$UNRESOLVED_COMMENTS"

# Generate action plan
section "Action Plan"

echo ""
echo "## AI Review Action Plan - PR #$PR_NUMBER"
echo ""
echo "### Next Steps:"
echo "1. Review the comments above"
echo "2. Prioritize based on:"
echo "   - 🔴 High: Security issues, breaking changes, critical bugs"
echo "   - 🟡 Medium: Code quality, error handling, documentation"
echo "   - 🟢 Low: Style suggestions, optimizations, nice-to-haves"
echo "3. Address each comment by:"
echo "   - Implementing the fix"
echo "   - Responding with rationale if declining"
echo "   - Creating follow-up issues for deferred items"
echo ""
echo "### Quick Commands:"
echo "- View PR in browser: gh pr view $PR_NUMBER --web"
echo "- Reply to comments: gh pr comment $PR_NUMBER"
echo "- Mark as ready: gh pr ready $PR_NUMBER"

echo ""
info "Review complete! 🎉"