/**
 * Architecture integrity guard. Runs in `node --test` (same runner as the
 * rest of the unit suite). Keeps the project's "Cloudflare-only" decision
 * observable: if anyone re-introduces a backend we explicitly decided not
 * to use, this test prints the offending file and fails.
 *
 * If you legitimately need to add one of these tools, update the allowlist
 * rather than disable the test — the failure message is the prompt to
 * justify the change.
 */

import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const appRoot = path.resolve(import.meta.dirname, '../..');

// Scope the scan to server-side code paths. `lib/client/*` and `lib/workshop`
// legitimately touch browser storage (localStorage/IndexedDB) — those are
// client bundles, not the Worker. The guard exists to keep server/ BFF code
// on the Cloudflare-only stack.
const SERVER_SCOPE = ['lib/server', 'app/api'];

test('runtime configuration stays on Cloudflare-only stack', async () => {
  const runtimeSources = await readRuntimeTypeScript(SERVER_SCOPE);
  const wranglerConfig = await readFile(path.join(appRoot, 'wrangler.jsonc'), 'utf8');
  const packageJson = JSON.parse(
    await readFile(path.join(appRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  // The architectures we explicitly chose NOT to use.
  const forbiddenPatterns: Array<{ label: string; pattern: RegExp }> = [
    { label: 'postgres client import', pattern: /from ['"]postgres['"]/ },
    { label: 'DATABASE_URL env', pattern: /DATABASE_URL/ },
    { label: 'hyperdrive binding', pattern: /HYPERDRIVE|hyperdrive/ },
    { label: 'firebase import', pattern: /from ['"]firebase[^'"]*['"]/ },
    { label: 'supabase import', pattern: /from ['"]@supabase\// },
    { label: 'mongodb import', pattern: /from ['"]mongodb['"]/ },
    { label: 'redis import', pattern: /from ['"]['"]?ioredis['"]?['"]?/ },
    {
      label: 'localStorage in server code',
      pattern: /\blocalStorage\.(getItem|setItem|removeItem|clear)\b/,
    },
  ];

  const offenders: string[] = [];
  for (const { label, pattern } of forbiddenPatterns) {
    const hits = findResidue(runtimeSources, pattern);
    if (hits.length > 0) {
      offenders.push(`${label}: ${hits.join(', ')}`);
    }
  }

  assert.deepEqual(
    findResidue(runtimeSources, /from ['"]postgres['"]/),
    [],
    'postgres client must not leak into runtime code',
  );
  assert.doesNotMatch(wranglerConfig, /"hyperdrive"|"HYPERDRIVE"|"postgres"/i);
  assert.equal(allDeps.postgres, undefined, 'postgres must remain uninstalled');
  assert.equal(allDeps['@supabase/supabase-js'], undefined);
  assert.equal(allDeps.firebase, undefined);
  assert.equal(allDeps.mongodb, undefined);

  if (offenders.length > 0) {
    assert.fail('Architecture guard tripped:\n  - ' + offenders.join('\n  - '));
  }
});

async function readRuntimeTypeScript(entries: string[]): Promise<Map<string, string>> {
  const sourceFiles: Array<Array<[string, string]>> = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(appRoot, entry);
      return entry.endsWith('.ts')
        ? readFile(entryPath, 'utf8').then(
            (contents): Array<[string, string]> => [[entry, contents]],
          )
        : readTypeScriptDirectory(entryPath);
    }),
  );

  return new Map(sourceFiles.flat());
}

async function readTypeScriptDirectory(
  directory: string,
): Promise<Array<[string, string]>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return readTypeScriptDirectory(entryPath);
      if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        return [
          [path.relative(appRoot, entryPath), await readFile(entryPath, 'utf8')] as [
            string,
            string,
          ],
        ];
      }
      return [];
    }),
  );
  return files.flat();
}

function findResidue(sources: Map<string, string>, pattern: RegExp): string[] {
  return [...sources].flatMap(([file, contents]) =>
    pattern.test(contents) ? [file] : [],
  );
}
