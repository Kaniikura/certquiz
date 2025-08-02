#!/usr/bin/env bun

/**
 * Script to remove barrel export files (index.ts) after imports have been transformed
 * This should be run AFTER remove-barrel-imports.ts
 */

import { readFileSync, rmSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import chalk from 'chalk';
import { glob } from 'glob';
import ts from 'typescript';

interface BarrelFileInfo {
  path: string;
  exportCount: number;
  isBarrelOnly: boolean;
}

/**
 * Checks if a file is a barrel export file (only contains re-exports)
 */
function isBarrelExportFile(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  let hasOnlyExports = true;
  let hasExports = false;

  function visit(node: ts.Node) {
    // Skip trivia (comments, whitespace)
    if (ts.isSourceFile(node)) {
      ts.forEachChild(node, visit);
      return;
    }

    // Check if it's an export declaration
    if (ts.isExportDeclaration(node)) {
      hasExports = true;
    } else if (
      ts.isVariableStatement(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) {
      // If it has actual code (not just exports), it's not a pure barrel
      hasOnlyExports = false;
    } else if (ts.isImportDeclaration(node)) {
      // Imports are okay in barrel files
    } else if (ts.isExpressionStatement(node)) {
      // Expression statements indicate it's not just a barrel
      hasOnlyExports = false;
    }
  }

  ts.forEachChild(sourceFile, visit);

  return hasExports && hasOnlyExports;
}

/**
 * Counts exports in a file
 */
function countExports(filePath: string): number {
  const content = readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  let exportCount = 0;

  function visit(node: ts.Node) {
    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        exportCount += node.exportClause.elements.length;
      } else if (!node.exportClause) {
        // export * counts as 1
        exportCount += 1;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return exportCount;
}

/**
 * Checks if any files still import from this barrel
 */
async function hasImporters(barrelPath: string): Promise<boolean> {
  const projectRoot = process.cwd();
  const relativeBarrelPath = relative(projectRoot, barrelPath);

  // Convert file path to possible import specifiers
  const possibleImports = [
    // @api/* style imports
    relativeBarrelPath
      .replace('apps/api/src/', '@api/')
      .replace('/index.ts', ''),
    relativeBarrelPath.replace('apps/api/src/', '@api/').replace('.ts', ''),
    // Relative imports
    `./${relativeBarrelPath.replace('/index.ts', '')}`,
    `../${relativeBarrelPath.replace('/index.ts', '')}`,
  ];

  const tsFiles = await glob('**/*.{ts,tsx}', {
    cwd: projectRoot,
    ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**'],
  });

  for (const tsFile of tsFiles) {
    const fullPath = resolve(projectRoot, tsFile);
    if (fullPath === barrelPath) continue; // Skip self

    const content = readFileSync(fullPath, 'utf-8');

    // Check for imports
    for (const importPath of possibleImports) {
      if (content.includes(`from '${importPath}'`) || content.includes(`from "${importPath}"`)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Main function
 */
async function main() {
  console.log(chalk.bold('🗑️  Barrel Export File Removal\n'));

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log(chalk.yellow('🔍 Running in dry-run mode - no files will be deleted\n'));
  }

  // Find all index.ts files
  console.log('📊 Finding barrel export files...');
  const indexFiles = await glob('**/index.ts', {
    cwd: process.cwd(),
    ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**'],
  });

  const barrelFiles: BarrelFileInfo[] = [];

  // Analyze each index.ts file
  for (const indexFile of indexFiles) {
    const fullPath = resolve(process.cwd(), indexFile);

    // Special cases - never remove these
    if (
      indexFile === 'apps/api/src/index.ts' || // Main entry point
      indexFile === 'apps/web/src/app.html' || // Wrong pattern
      indexFile.includes('node_modules') ||
      indexFile.includes('.svelte-kit')
    ) {
      continue;
    }

    const isBarrel = isBarrelExportFile(fullPath);
    if (isBarrel) {
      barrelFiles.push({
        path: fullPath,
        exportCount: countExports(fullPath),
        isBarrelOnly: true,
      });
    }
  }

  console.log(`\n📦 Found ${barrelFiles.length} barrel export files\n`);

  // Check which files can be safely removed
  const safeToRemove: BarrelFileInfo[] = [];
  const stillHasImporters: BarrelFileInfo[] = [];

  console.log('🔍 Checking for remaining imports...');
  for (const barrel of barrelFiles) {
    const hasImports = await hasImporters(barrel.path);
    if (hasImports) {
      stillHasImporters.push(barrel);
    } else {
      safeToRemove.push(barrel);
    }
  }

  // Print results
  if (safeToRemove.length > 0) {
    console.log(chalk.green('\n✅ Safe to remove:'));
    for (const barrel of safeToRemove) {
      console.log(`   ${relative(process.cwd(), barrel.path)} (${barrel.exportCount} exports)`);
    }
  }

  if (stillHasImporters.length > 0) {
    console.log(chalk.red('\n❌ Still has importers (run remove-barrel-imports.ts first):'));
    for (const barrel of stillHasImporters) {
      console.log(`   ${relative(process.cwd(), barrel.path)} (${barrel.exportCount} exports)`);
    }
  }

  // Remove files if not dry-run
  if (!dryRun && safeToRemove.length > 0) {
    console.log(chalk.yellow('\n🗑️  Removing barrel files...'));
    let removedCount = 0;

    for (const barrel of safeToRemove) {
      try {
        rmSync(barrel.path);
        console.log(chalk.green(`   ✓ Removed ${relative(process.cwd(), barrel.path)}`));
        removedCount++;
      } catch (error) {
        console.log(
          chalk.red(`   ✗ Failed to remove ${relative(process.cwd(), barrel.path)}: ${error}`)
        );
      }
    }

    console.log(chalk.bold(`\n✨ Removed ${removedCount} barrel export files!`));
  } else if (dryRun) {
    console.log(
      chalk.yellow(`\n⚠️  Dry run complete. ${safeToRemove.length} files would be removed.`)
    );
    console.log(chalk.gray('   Run without --dry-run to actually remove files.'));
  } else {
    console.log(chalk.gray('\n📭 No barrel files to remove.'));
  }
}

// Run the script
main().catch(console.error);
