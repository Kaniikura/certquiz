// Flexible N:N emoji-to-type mapping for commit messages
// Based on gitmoji.dev and conventional commits

// Emoji to valid types mapping (N:N relationship)
const emojiToTypes = {
  // Features and improvements
  '✨': ['feat', 'refactor'], // Introduce new features or improvements
  '🎉': ['feat', 'init'], // Begin a project or major feature
  '🚀': ['feat', 'ci', 'deploy'], // Deploy stuff or release
  '🎸': ['feat'], // Add a feature (fun variant)
  '✏️': ['feat', 'fix'], // Fix typos or small text changes
  '🍱': ['feat'], // Add or update assets
  '📱': ['feat'], // Work on responsive design

  // Bug fixes
  '🐛': ['fix'], // Fix a bug
  '🚑️': ['fix'], // Critical hotfix
  '🩹': ['fix'], // Simple fix for non-critical issue
  '🔒': ['fix', 'security'], // Fix security issues
  '🔊': ['fix'], // Add or update logs
  '🔇': ['fix'], // Remove logs
  '🚨': ['fix', 'test'], // Fix compiler/linter warnings

  // Documentation
  '📝': ['docs'], // Add or update documentation
  '💡': ['docs', 'feat'], // Add or update comments in source code
  '📄': ['docs'], // Add or update license
  '📚': ['docs'], // Documentation improvements
  '🌐': ['docs'], // Internationalization and localization

  // Code style and formatting
  '🎨': ['style'], // Improve structure/format of code
  '💄': ['style', 'feat'], // Add or update UI and style files

  // Refactoring
  '♻️': ['refactor'], // Refactor code
  '🏗️': ['refactor'], // Make architectural changes
  '🚚': ['refactor'], // Move or rename resources

  // Performance
  '⚡️': ['perf', 'refactor'], // Improve performance
  '🐎': ['perf'], // Significant performance improvement
  '📈': ['perf'], // Add or update analytics or tracking

  // Tests
  '✅': ['test'], // Add, update, or pass tests
  '🧪': ['test'], // Add a failing test
  '🤡': ['test'], // Mock things

  // Build and dependencies
  '📦': ['build'], // Add or update compiled files or packages
  '🔨': ['build', 'refactor'], // Add or update development scripts
  '👷': ['build', 'ci'], // Add or update CI build system
  '🔧': ['chore', 'build'], // Add or update configuration files
  '➕': ['feat', 'build'], // Add a dependency
  '➖': ['build', 'chore'], // Remove a dependency

  // CI/CD
  '💚': ['ci'], // Fix CI Build
  '🎡': ['ci', 'deploy'], // Add or update CD

  // Chores and maintenance
  '📌': ['chore'], // Pin dependencies to specific versions
  '⬆️': ['chore'], // Upgrade dependencies
  '⬇️': ['chore'], // Downgrade dependencies
  '🔥': ['chore'], // Remove code or files
  '🗑️': ['chore'], // Deprecate code
  '🚮': ['chore'], // Clean up

  // Other types
  '⏪': ['revert'], // Revert changes
  '🚧': ['wip'], // Work in progress
  '🔐': ['security'], // Add or update secrets
  '🐳': ['docker'], // Docker related
  '🔀': ['merge'], // Merge branches
  '💥': ['breaking'], // Introduce breaking changes
};

// Type to emojis mapping (for reference and validation)
const typeToEmojis = {
  feat: ['✨', '🎉', '🚀', '🎸', '✏️', '🍱', '📱', '💄', '➕', '💡'],
  fix: ['🐛', '🚑️', '🩹', '🔒', '🔊', '🔇', '🚨', '✏️'],
  docs: ['📝', '💡', '📄', '📚', '🌐'],
  style: ['🎨', '💄'],
  refactor: ['♻️', '🏗️', '🚚', '✨', '🔨', '⚡️'],
  perf: ['⚡️', '🐎', '📈'],
  test: ['✅', '🧪', '🤡', '🚨'],
  build: ['📦', '🔨', '👷', '🔧', '➕', '➖'],
  ci: ['👷', '💚', '🎡', '🚀'],
  chore: ['🔧', '📌', '⬆️', '⬇️', '🔥', '🗑️', '🚮', '➖'],
  revert: ['⏪'],
  wip: ['🚧'],
  security: ['🔒', '🔐'],
  init: ['🎉'],
  deploy: ['🚀', '🎡'],
  docker: ['🐳'],
  merge: ['🔀'],
  breaking: ['💥'],
};

module.exports = {
  parserPreset: {
    parserOpts: {
      // Parse format: emoji type(scope): subject
      // Matches: ✨ feat(api): add user authentication
      headerPattern: /^(.{1,2})\s+(\w+)(?:\(([^)]+)\))?:\s+(.+)$/,
      headerCorrespondence: ['emoji', 'type', 'scope', 'subject'],
    },
  },
  rules: {
    // Custom rule: validate emoji-type matching
    'emoji-type-match': [2, 'always'],

    // Standard rules
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-max-length': [2, 'always', 50],
    'scope-case': [0], // Disabled to allow flexibility

    // Disable default type rules since we handle it custom
    'type-enum': [0],
    'type-case': [0],
  },
  plugins: [
    {
      rules: {
        'emoji-type-match': ({ emoji, type }) => {
          // Check if the commit message follows the basic format
          if (!emoji || !type) {
            const validEmojis = Object.keys(emojiToTypes).slice(0, 20).join(', ');
            const validTypes = Object.keys(typeToEmojis).join(', ');
            return [
              false,
              `Commit message must follow format: "emoji type(scope): subject"\n` +
                'Example: ✨ feat(auth): add user authentication\n' +
                `\nValid types: ${validTypes}\n` +
                `Some valid emojis: ${validEmojis}...`,
            ];
          }

          // Check if emoji is defined
          if (!emojiToTypes[emoji]) {
            const allEmojis = Object.keys(emojiToTypes);
            const suggestions = allEmojis.slice(0, 30).join(', ');
            return [
              false,
              `'${emoji}' is not a valid emoji.\n` +
                `Available emojis (partial list): ${suggestions}...\n` +
                'See full list at: https://gitmoji.dev/',
            ];
          }

          // Check if type is valid for this emoji
          const validTypes = emojiToTypes[emoji];
          if (!validTypes.includes(type)) {
            return [
              false,
              `'${emoji}' cannot be used with type '${type}'.\n` +
                `Valid types for ${emoji}: ${validTypes.join(', ')}\n` +
                `Example: ${emoji} ${validTypes[0]}: your message here`,
            ];
          }

          return [true];
        },
      },
    },
  ],
};
