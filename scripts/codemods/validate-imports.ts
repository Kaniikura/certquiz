#!/usr/bin/env bun

/**
 * Validation script to ensure all imports resolve correctly after barrel transformation
 * Run this after applying the barrel import transformations
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import chalk from 'chalk';
import { glob } from 'glob';
import ts from 'typescript';

interface ImportIssue {
  file: string;
  line: number;
  importPath: string;
  issue: string;
}

/**
 * Resolves a module path from an import statement
 */
function resolveImportPath(fromFile: string, importPath: string): string | null {
  // Handle @api/* imports
  if (importPath.startsWith('@api/')) {
    const apiPath = importPath.replace('@api/', 'apps/api/src/');
    const fullPath = resolve(process.cwd(), apiPath);

    // Try various extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of extensions) {
      if (existsSync(fullPath + ext)) {
        return fullPath + ext;
      }
    }

    // Try as directory with index.ts
    const indexPath = join(fullPath, 'index.ts');
    if (existsSync(indexPath)) {
      return indexPath;
    }

    return null;
  }

  // Handle relative imports
  if (importPath.startsWith('.')) {
    const fromDir = dirname(fromFile);
    const resolvedPath = resolve(fromDir, importPath);

    // Try various extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of extensions) {
      if (existsSync(resolvedPath + ext)) {
        return resolvedPath + ext;
      }
    }

    // Try as directory with index.ts
    const indexPath = join(resolvedPath, 'index.ts');
    if (existsSync(indexPath)) {
      return indexPath;
    }

    return null;
  }

  // For node_modules imports, we assume they're valid
  return 'node_modules';
}

/**
 * Checks if an import path is valid
 */
function checkImport(filePath: string, importPath: string): ImportIssue | null {
  // Skip node_modules imports
  if (!importPath.startsWith('.') && !importPath.startsWith('@api/')) {
    return null;
  }

  const resolvedPath = resolveImportPath(filePath, importPath);

  if (!resolvedPath) {
    return {
      file: filePath,
      line: 0, // Will be filled in later
      importPath,
      issue: 'Import path does not resolve to any file',
    };
  }

  // Check if importing from an index.ts barrel file
  if (resolvedPath.endsWith('/index.ts')) {
    return {
      file: filePath,
      line: 0,
      importPath,
      issue: 'Still importing from barrel export (index.ts)',
    };
  }

  return null;
}

/**
 * Validates all imports in a TypeScript file
 */
function validateFile(filePath: string): ImportIssue[] {
  const content = readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const issues: ImportIssue[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const importPath = node.moduleSpecifier.text;
      const issue = checkImport(filePath, importPath);

      if (issue) {
        const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        issue.line = lineNumber;
        issues.push(issue);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return issues;
}

/**
 * Main function
 */
async function main() {
  console.log(chalk.bold('🔍 Import Validation\n'));

  // Find all TypeScript files
  console.log('📊 Analyzing imports...');
  const tsFiles = await glob('**/*.{ts,tsx}', {
    cwd: process.cwd(),
    ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**', 'scripts/**'],
  });

  const allIssues: ImportIssue[] = [];
  let filesChecked = 0;

  // Check each file
  for (const tsFile of tsFiles) {
    const fullPath = resolve(process.cwd(), tsFile);
    const issues = validateFile(fullPath);

    if (issues.length > 0) {
      allIssues.push(...issues);
    }

    filesChecked++;

    // Progress indicator
    if (filesChecked % 50 === 0) {
      process.stdout.write('.');
    }
  }

  console.log('\n');

  // Group issues by type
  const brokenImports = allIssues.filter((i) => i.issue.includes('does not resolve'));
  const barrelImports = allIssues.filter((i) => i.issue.includes('barrel export'));

  // Print results
  if (brokenImports.length > 0) {
    console.log(chalk.red('❌ Broken imports:'));
    for (const issue of brokenImports) {
      console.log(chalk.red(`   ${issue.file}:${issue.line} - "${issue.importPath}"`));
    }
    console.log();
  }

  if (barrelImports.length > 0) {
    console.log(chalk.yellow('⚠️  Still importing from barrel exports:'));
    for (const issue of barrelImports) {
      console.log(chalk.yellow(`   ${issue.file}:${issue.line} - "${issue.importPath}"`));
    }
    console.log();
  }

  // Summary
  console.log(chalk.bold('📊 Summary:'));
  console.log(`   Files checked: ${filesChecked}`);
  console.log(`   Broken imports: ${brokenImports.length}`);
  console.log(`   Barrel imports: ${barrelImports.length}`);

  if (allIssues.length === 0) {
    console.log(chalk.green('\n✅ All imports are valid!'));
  } else {
    console.log(chalk.red(`\n⚠️  Found ${allIssues.length} import issues that need to be fixed.`));
    process.exit(1);
  }
}

// Run validation
main().catch(console.error);
