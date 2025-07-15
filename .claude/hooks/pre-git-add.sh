#!/bin/sh
# Pre-git-add hook for Claude Code - runs bun check before git add

read json
tool_name=$(echo "$json" | jq -r '.tool_name // empty' 2>/dev/null)
command=$(echo "$json" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Check if this is a git add command
if [ "$tool_name" = "Bash" ] && echo "$command" | grep -q "^git add"; then
  cd /home/ubuntu/Projects/certquiz
  
  # Run bun check and capture output
  output=$(bun run check 2>&1)
  exit_code=$?
  
  if [ $exit_code -ne 0 ]; then
    # Block the git add operation - escape output for JSON
    escaped_output=$(echo "$output" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
    echo "{\"decision\": \"block\", \"reason\": \"❌ bun check failed. Please fix lint/format/type errors before adding files to git.\\n\\nErrors:\\n${escaped_output}\"}"
    exit 0
  fi
fi

# Allow all other operations to proceed
exit 0