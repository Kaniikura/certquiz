#!/bin/bash
# Pre-git-add hook for Claude Code - runs bun check before git add
# Abort on error, unset vars, or failed pipeline
set -euo pipefail

# Read entire STDIN payload, including newlines
json=$(cat)
tool_name=$(echo "$json" | jq -r '.tool_name // empty' 2>/dev/null)
command=$(echo "$json" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Check if this is a git add command
if [ "$tool_name" = "Bash" ] && echo "$command" | grep -q "^git add"; then
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
    jq -n '{"decision":"block","reason":"Cannot determine repository root – bun check skipped."}'
    exit 0  # Exit 0 is required for Claude Code hooks to properly block the operation
  }
  cd "$REPO_ROOT" || {
    jq -n '{"decision":"block","reason":"Failed to cd into repository root – bun check skipped."}'
    exit 0  # Exit 0 is required for Claude Code hooks to properly block the operation
  }
  
  # Run bun check and capture output (temporarily disable -e to capture exit code)
  set +e
  output=$(bun run check 2>&1)
  exit_code=$?
  set -e
  
  if [ $exit_code -ne 0 ]; then
    # Block the git add operation - use jq for proper JSON escaping
    jq -n --arg output "$output" '{"decision": "block", "reason": ("❌ bun check failed. Please fix lint/format/type errors before adding files to git.\n\nErrors:\n" + $output)}'
    exit 0  # Exit 0 is required for Claude Code hooks to properly block the operation
  fi
fi

# Allow all other operations to proceed
exit 0