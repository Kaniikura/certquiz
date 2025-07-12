import { createHash } from 'node:crypto';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Result } from '@api/shared/result';

// Types
export interface MigrationFile {
  filename: string;
  path: string;
  type: 'up' | 'down';
  baseName: string;
  sequenceNumber: number;
}

export type FileError =
  | { type: 'FileSystemError'; path: string; reason: unknown }
  | { type: 'PathTraversalError'; path: string }
  | { type: 'InvalidFilename'; filename: string };

// Value object helpers (inline to keep it simple)
function validateMigrationFilename(
  filename: string
): Result<{ baseName: string; type: 'up' | 'down'; sequenceNumber: number }, FileError> {
  const pattern = /^(\d{4}_[a-z0-9_]+)(\.down)?\.sql$/;
  const match = filename.match(pattern);

  if (!match) {
    return Result.err({ type: 'InvalidFilename', filename });
  }

  const baseName = match[1];
  const type = match[2] ? 'down' : 'up';
  const sequenceNumber = parseInt(baseName.substring(0, 4), 10);

  return Result.ok({ baseName, type, sequenceNumber });
}

function validatePath(inputPath: string, allowedRoot: string): Result<string, FileError> {
  const resolved = path.resolve(inputPath);
  const normalizedRoot = path.resolve(allowedRoot);

  if (!resolved.startsWith(normalizedRoot)) {
    return Result.err({ type: 'PathTraversalError', path: resolved });
  }

  return Result.ok(resolved);
}

// Repository functions
export async function listMigrationFiles(
  migrationsPath: string
): Promise<Result<MigrationFile[], FileError>> {
  try {
    const entries = await readdir(migrationsPath, { withFileTypes: true });
    const migrations: MigrationFile[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.sql')) {
        continue;
      }

      const filenameResult = validateMigrationFilename(entry.name);
      if (!filenameResult.success) {
        continue; // Skip invalid files
      }

      const fullPath = path.join(migrationsPath, entry.name);
      const pathResult = validatePath(fullPath, migrationsPath);
      if (!pathResult.success) {
        return pathResult;
      }

      migrations.push({
        filename: entry.name,
        path: pathResult.data,
        type: filenameResult.data.type,
        baseName: filenameResult.data.baseName,
        sequenceNumber: filenameResult.data.sequenceNumber,
      });
    }

    // Sort by sequence number
    migrations.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    return Result.ok(migrations);
  } catch (error) {
    return Result.err({ type: 'FileSystemError', path: migrationsPath, reason: error });
  }
}

export async function readFileContent(filepath: string): Promise<Result<string, FileError>> {
  try {
    const content = await readFile(filepath, 'utf-8');
    return Result.ok(content);
  } catch (error) {
    return Result.err({ type: 'FileSystemError', path: filepath, reason: error });
  }
}

export async function calculateFileHash(filepath: string): Promise<Result<string, FileError>> {
  const contentResult = await readFileContent(filepath);
  if (!contentResult.success) {
    return contentResult;
  }

  const hash = createHash('sha256').update(contentResult.data).digest('hex');
  return Result.ok(hash);
}

export async function fileExists(filepath: string): Promise<Result<boolean, FileError>> {
  try {
    await access(filepath);
    return Result.ok(true);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return Result.ok(false);
    }
    return Result.err({ type: 'FileSystemError', path: filepath, reason: error });
  }
}

export async function findMigrationByHash(
  migrationsPath: string,
  targetHash: string
): Promise<Result<MigrationFile | null, FileError>> {
  const filesResult = await listMigrationFiles(migrationsPath);
  if (!filesResult.success) {
    return filesResult;
  }

  const upMigrations = filesResult.data.filter((f) => f.type === 'up');

  for (const file of upMigrations) {
    const hashResult = await calculateFileHash(file.path);
    if (!hashResult.success) {
      continue;
    }

    if (hashResult.data === targetHash) {
      return Result.ok(file);
    }
  }

  return Result.ok(null);
}

export async function hasDownMigration(
  migrationsPath: string,
  baseName: string
): Promise<Result<boolean, FileError>> {
  const downPath = path.join(migrationsPath, `${baseName}.down.sql`);
  return fileExists(downPath);
}

// Export internals for testing
export const __internal__ = {
  validateMigrationFilename,
  validatePath,
};
