#!/usr/bin/env bash
set -euo pipefail

# Get Git root directory
ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -z "${ROOT}" ]]; then
    echo "Error: Not in a Git repository. Claude Code hooks require a Git repository." >&2
    exit 1
fi

# Export as environment variable for use in other scripts
export CC_PROJECT_ROOT="${ROOT}"

# Change to root directory and execute the original script
cd "${ROOT}"

# Ensure we have a command to execute
if [ "$#" -eq 0 ]; then
    echo "Error: run-at-root.sh: no command provided" >&2
    exit 1
fi

exec "$@"