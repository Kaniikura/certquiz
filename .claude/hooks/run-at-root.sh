#!/usr/bin/env bash
set -euo pipefail

# Get Git root directory (fallback to current directory if not in a Git repo)
ROOT=$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null || echo "${PWD}")

# Export as environment variable for use in other scripts
export CC_PROJECT_ROOT="${ROOT}"

# Change to root directory and execute the original script
cd "${ROOT}"
exec "$@"