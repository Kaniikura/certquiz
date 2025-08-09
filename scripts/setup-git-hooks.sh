#!/bin/bash
# Setup script for git hooks with commitlint

echo "🔧 Setting up git hooks for commit message validation..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo "❌ Error: This directory is not a git repository"
  exit 1
fi

# Check if bun is installed
if ! command -v bun &> /dev/null; then
  echo "❌ Error: bun is not installed. Please install bun first."
  exit 1
fi

# Install dependencies if not already installed
if [ ! -d "node_modules/simple-git-hooks" ] || [ ! -d "node_modules/@commitlint/cli" ]; then
  echo "📦 Installing dependencies..."
  bun add -D simple-git-hooks @commitlint/cli
else
  echo "✅ Dependencies already installed"
fi

# Check if commitlint.config.js exists
if [ ! -f "commitlint.config.js" ]; then
  echo "❌ Error: commitlint.config.js not found in project root"
  exit 1
fi

# Run simple-git-hooks to set up the hooks
echo "⚙️  Configuring git hooks..."
bunx simple-git-hooks

echo "✅ Git hooks setup complete!"
echo ""
echo "📝 Commit message format: emoji type(scope): subject"
echo "   Example: ✨ feat(auth): add user authentication"
echo ""
echo "🎯 Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, wip, security, init, deploy, docker, merge, breaking"
echo ""
echo "📚 See https://gitmoji.dev/ for emoji meanings"
echo "📖 See .claude/commit-convention.md for project conventions"