# Claude Command: Commit

This command helps you create well-formatted commits following the project's commit conventions defined in [.claude/commit-convention.md](../commit-convention.md).

## Usage

To create a commit, just type:
```
/commit
```

Or with options:
```
/commit --no-verify
```

## What This Command Does

1. Unless specified with `--no-verify`, automatically runs pre-commit checks:
   - `bun run check` to ensure code quality
   - `bun run typecheck` to verify the build succeeds
2. Checks which files are staged with `git status`
3. If 0 files are staged, automatically adds all modified and new files with `git add`
4. Performs a `git diff` to understand what changes are being committed
5. Analyzes the diff to determine if multiple distinct logical changes are present
6. If multiple distinct changes are detected, suggests breaking the commit into multiple smaller commits
7. For each commit (or the single commit if not split), creates a commit message using the conventions defined in `.claude/commit-convention.md`

## Commit Convention

This command follows the project's commit convention. For detailed information about:
- Commit message format
- Type and emoji mappings
- Scope guidelines
- Commit message rules
- Project-specific patterns
- Examples

Please refer to: [.claude/commit-convention.md](../commit-convention.md)

## Command Options

- `--no-verify`: Skip running the pre-commit checks (lint, build, generate:docs)

## Important Notes

- By default, pre-commit checks (`bun run check`, `bun run typecheck`) will run to ensure code quality
- If these checks fail, you'll be asked if you want to proceed with the commit anyway or fix the issues first
- If specific files are already staged, the command will only commit those files
- If no files are staged, it will automatically stage all modified and new files
- The commit message will be constructed based on the changes detected
- Before committing, the command will review the diff to identify if multiple commits would be more appropriate
- If suggesting multiple commits, it will help you stage and commit the changes separately
- Always reviews the commit diff to ensure the message matches the changes

For commit best practices, VSCode integration, and quick reference examples, see: [.claude/commit-convention.md](../commit-convention.md)