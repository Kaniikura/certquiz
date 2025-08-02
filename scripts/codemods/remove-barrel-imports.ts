#!/usr/bin/env bun
/**
 * Codemod to transform barrel imports to direct imports
 * This script analyzes imports from index.ts files and rewrites them to import directly from source files
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { glob } from 'glob';
import ts from 'typescript';

// Map of barrel exports to their actual source locations
// This will be populated by analyzing index.ts files
const barrelExportMap = new Map<string, Map<string, string>>();

interface ImportInfo {
  moduleSpecifier: string;
  namedImports: string[];
  defaultImport?: string;
  namespaceImport?: string;
}

/**
 * Analyzes an index.ts file to build a map of exports to their source locations
 */
function analyzeBarrelFile(indexPath: string): Map<string, string> {
  const exportMap = new Map<string, string>();
  const content = readFileSync(indexPath, 'utf-8');
  const sourceFile = ts.createSourceFile(indexPath, content, ts.ScriptTarget.Latest, true);

  function visit(node: ts.Node) {
    // Handle export declarations like: export { Foo } from './Foo';
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const sourcePath = node.moduleSpecifier.text;
      const resolvedSource = resolveModulePath(dirname(indexPath), sourcePath);

      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach((element) => {
          const exportedName = element.name.text;
          const _originalName = element.propertyName?.text || exportedName;
          exportMap.set(exportedName, resolvedSource);
        });
      }
    }

    // Handle re-export all: export * from './module';
    if (
      ts.isExportDeclaration(node) &&
      !node.exportClause &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const sourcePath = node.moduleSpecifier.text;
      const resolvedSource = resolveModulePath(dirname(indexPath), sourcePath);

      // For export *, we need to analyze the source file to know what's exported
      if (existsSync(resolvedSource)) {
        const sourceExports = getExportsFromFile(resolvedSource);
        sourceExports.forEach((exportName) => {
          exportMap.set(exportName, resolvedSource);
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return exportMap;
}

/**
 * Processes named export declarations
 */
function processNamedExports(node: ts.Node, exports: string[]): void {
  if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
    node.exportClause.elements.forEach((element) => {
      exports.push(element.name.text);
    });
  }
}

/**
 * Processes exported declarations (const/function/class)
 */
function processExportedDeclarations(node: ts.Node, exports: string[]): void {
  if (!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
    return;
  }

  if (ts.isVariableStatement(node)) {
    node.declarationList.declarations.forEach((decl) => {
      if (ts.isIdentifier(decl.name)) {
        exports.push(decl.name.text);
      }
    });
  } else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
    if (node.name) {
      exports.push(node.name.text);
    }
  }
}

/**
 * Gets all named exports from a TypeScript file
 */
function getExportsFromFile(filePath: string): string[] {
  const exports: string[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  function visit(node: ts.Node) {
    processNamedExports(node, exports);
    processExportedDeclarations(node, exports);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return exports;
}

/**
 * Resolves a module path to an absolute path
 */
function resolveModulePath(fromDir: string, modulePath: string): string {
  const resolved = resolve(fromDir, modulePath);

  // Try with .ts extension
  if (existsSync(`${resolved}.ts`)) {
    return `${resolved}.ts`;
  }

  // Try as directory with index.ts
  const indexPath = join(resolved, 'index.ts');
  if (existsSync(indexPath)) {
    return indexPath;
  }

  // Return as is if file exists
  if (existsSync(resolved)) {
    return resolved;
  }

  return resolved;
}

/**
 * Transforms import statements in a source file
 */
function transformFile(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  let modified = false;
  const importTransforms: Array<{ start: number; end: number; replacement: string }> = [];

  function visit(node: ts.Node) {
    if (
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const moduleSpecifier = node.moduleSpecifier.text;

      // Check if this imports from a barrel export
      const barrelPath = findBarrelPath(moduleSpecifier);
      if (barrelPath && barrelExportMap.has(barrelPath)) {
        const exportMap = barrelExportMap.get(barrelPath);
        if (!exportMap) return;
        const importInfo = extractImportInfo(node);

        // Generate new import statements
        const newImports = generateDirectImports(filePath, importInfo, exportMap);

        if (newImports.length > 0) {
          importTransforms.push({
            start: node.pos,
            end: node.end,
            replacement: newImports.join('\n'),
          });
          modified = true;
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Apply transformations
  if (modified) {
    let newContent = content;

    // Apply transformations in reverse order to maintain positions
    importTransforms.sort((a, b) => b.start - a.start);

    for (const transform of importTransforms) {
      newContent =
        newContent.substring(0, transform.start) +
        transform.replacement +
        newContent.substring(transform.end);
    }

    writeFileSync(filePath, newContent);
    console.log(`✅ Transformed: ${relative(process.cwd(), filePath)}`);
    return true;
  }

  return false;
}

/**
 * Finds the barrel file path for a given import specifier
 */
function findBarrelPath(moduleSpecifier: string): string | null {
  // Handle @api/* imports
  if (moduleSpecifier.startsWith('@api/')) {
    const relativePath = moduleSpecifier.replace('@api/', 'apps/api/src/');
    const possiblePaths = [
      resolve(process.cwd(), relativePath, 'index.ts'),
      resolve(process.cwd(), `${relativePath}/index.ts`),
      resolve(process.cwd(), `${relativePath}.ts`),
    ];

    for (const path of possiblePaths) {
      if (existsSync(path) && path.endsWith('index.ts')) {
        return path;
      }
    }
  }

  return null;
}

/**
 * Extracts import information from an import declaration
 */
function extractImportInfo(node: ts.ImportDeclaration): ImportInfo {
  const info: ImportInfo = {
    moduleSpecifier: (node.moduleSpecifier as ts.StringLiteral).text,
    namedImports: [],
  };

  if (node.importClause) {
    // Default import
    if (node.importClause.name) {
      info.defaultImport = node.importClause.name.text;
    }

    // Named imports
    if (node.importClause.namedBindings) {
      if (ts.isNamedImports(node.importClause.namedBindings)) {
        info.namedImports = node.importClause.namedBindings.elements.map((el) => el.name.text);
      } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
        info.namespaceImport = node.importClause.namedBindings.name.text;
      }
    }
  }

  return info;
}

/**
 * Generates direct import statements
 */
function generateDirectImports(
  currentFile: string,
  importInfo: ImportInfo,
  exportMap: Map<string, string>
): string[] {
  const imports: string[] = [];
  const importGroups = new Map<string, string[]>();

  // Group imports by source file
  for (const namedImport of importInfo.namedImports) {
    const sourcePath = exportMap.get(namedImport);
    if (sourcePath) {
      if (!importGroups.has(sourcePath)) {
        importGroups.set(sourcePath, []);
      }
      importGroups.get(sourcePath)?.push(namedImport);
    }
  }

  // Generate import statements
  for (const [sourcePath, names] of importGroups) {
    const importPath = generateImportPath(currentFile, sourcePath);
    const importList = names.join(', ');
    imports.push(`import { ${importList} } from '${importPath}';`);
  }

  return imports;
}

/**
 * Generates the import path from current file to target
 */
function generateImportPath(fromFile: string, toFile: string): string {
  // Remove .ts extension for imports
  const targetPath = toFile.replace(/\.ts$/, '');

  // Check if target is in apps/api/src
  const apiSrcPath = resolve(process.cwd(), 'apps/api/src');
  if (targetPath.startsWith(apiSrcPath)) {
    // Use @api alias
    return `@api${targetPath.substring(apiSrcPath.length)}`;
  }

  // Otherwise use relative path
  const relativePath = relative(dirname(fromFile), targetPath);
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

/**
 * Main function
 */
async function main() {
  console.log('🔄 Starting barrel import transformation...\n');

  // Step 1: Find all index.ts files and analyze their exports
  console.log('📊 Analyzing barrel exports...');
  const indexFiles = await glob('**/index.ts', {
    cwd: process.cwd(),
    ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**'],
  });

  for (const indexFile of indexFiles) {
    const fullPath = resolve(process.cwd(), indexFile);
    const exports = analyzeBarrelFile(fullPath);
    if (exports.size > 0) {
      barrelExportMap.set(fullPath, exports);
      console.log(`  ✓ ${indexFile} (${exports.size} exports)`);
    }
  }

  console.log(`\n📦 Found ${barrelExportMap.size} barrel files with exports\n`);

  // Step 2: Transform all TypeScript files
  console.log('🔨 Transforming imports...');
  const tsFiles = await glob('**/*.{ts,tsx}', {
    cwd: process.cwd(),
    ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**', '**/index.ts'],
  });

  let transformedCount = 0;
  for (const tsFile of tsFiles) {
    const fullPath = resolve(process.cwd(), tsFile);
    if (transformFile(fullPath)) {
      transformedCount++;
    }
  }

  console.log('\n✨ Transformation complete!');
  console.log(`   Analyzed ${tsFiles.length} files`);
  console.log(`   Transformed ${transformedCount} files`);
}

// Run the codemod
main().catch(console.error);
