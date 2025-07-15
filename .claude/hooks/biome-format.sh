#!/bin/sh
# Biome hook for Claude Code - runs biome on individual files

read json

# Try to extract file path from different possible locations
file_path=$(echo "$json" | jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null)

# If we got a file path, process it
if [ -n "$file_path" ]; then
  case "$file_path" in
    *.ts|*.tsx|*.js|*.jsx|*.json|*.jsonc|*.svelte)
      cd /home/ubuntu/Projects/certquiz && biome check --write "$file_path"
      ;;
  esac
else
  # Try MultiEdit format
  file_paths=$(echo "$json" | jq -r '.tool_input.edits[]?.file_path // empty' 2>/dev/null | sort -u)
  if [ -n "$file_paths" ]; then
    for file_path in $file_paths; do
      case "$file_path" in
        *.ts|*.tsx|*.js|*.jsx|*.json|*.jsonc|*.svelte)
          cd /home/ubuntu/Projects/certquiz && biome check --write "$file_path"
          ;;
      esac
    done
  fi
fi