#!/bin/bash
# Biome hook for Claude Code - runs biome on individual files
# Abort on error, unset vars, or failed pipeline
set -euo pipefail

# Read entire STDIN payload, including newlines
json=$(cat)

# Get repository root - silently exit if not in a git repo (formatting is optional)
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0

# Try to extract file path from different possible locations
file_path=$(echo "$json" | jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null)

# If we got a file path, process it
if [ -n "$file_path" ]; then
  case "$file_path" in
    *.ts|*.tsx|*.js|*.jsx|*.json|*.jsonc|*.svelte)
      cd "$REPO_ROOT" && biome check --write "$file_path"
      ;;
  esac
else
  # Try MultiEdit format
  echo "$json" | jq -r '.tool_input.edits[]?.file_path // empty' 2>/dev/null | sort -u | while IFS= read -r file_path; do
    if [ -n "$file_path" ]; then
      case "$file_path" in
        *.ts|*.tsx|*.js|*.jsx|*.json|*.jsonc|*.svelte)
          cd "$REPO_ROOT" && biome check --write "$file_path"
          ;;
      esac
    fi
  done
fi