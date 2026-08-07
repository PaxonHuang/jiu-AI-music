// Provider selection.
//
// Resolution order:
//   1. MUSIC_PROVIDER=mock       -> always the mock
//   2. MUSIC_PROVIDER=volcengine -> always Volcengine (throws if keys missing)
//   3. unset                     -> Volcengine when keys are present,
//                                   otherwise the mock outside production
//
// The production guard matters: silently serving sample audio from a
// deployed Worker because a secret went missing would look like a working
// app shipping fake songs. In production a missing key is a hard error.

import { createMockProvider, MOCK_PROVIDER_NAME } from './mock-provider.ts';
import { createVolcengineProvider, VOLCENGINE_PROVIDER_NAME } from './volcengine-provider.ts';
import type { MusicProvider } from './types.ts';

export type MusicProviderName = typeof VOLCENGINE_PROVIDER_NAME | typeof MOCK_PROVIDER_NAME;

export interface SelectProviderEnv {
  MUSIC_PROVIDER?: string;
  VOLC_ACCESS_KEY?: string;
  VOLC_SECRET_KEY?: string;
  NODE_ENV?: string;
}

export function resolveProviderName(env: SelectProviderEnv): MusicProviderName {
  const requested = env.MUSIC_PROVIDER?.trim().toLowerCase();
  if (requested === MOCK_PROVIDER_NAME) return MOCK_PROVIDER_NAME;
  if (requested === VOLCENGINE_PROVIDER_NAME) return VOLCENGINE_PROVIDER_NAME;
  if (requested) {
    throw new Error(
      `Unknown MUSIC_PROVIDER "${requested}" — expected "${VOLCENGINE_PROVIDER_NAME}" or "${MOCK_PROVIDER_NAME}"`,
    );
  }

  if (env.VOLC_ACCESS_KEY && env.VOLC_SECRET_KEY) return VOLCENGINE_PROVIDER_NAME;

  if (env.NODE_ENV === 'production') {
    throw new Error(
      'VOLC_ACCESS_KEY / VOLC_SECRET_KEY are required in production. ' +
        `Set MUSIC_PROVIDER=${MOCK_PROVIDER_NAME} to opt into sample audio instead.`,
    );
  }

  return MOCK_PROVIDER_NAME;
}

// Cached per resolved name so the mock keeps its in-flight tasks between
// polls within an isolate.
const cache = new Map<MusicProviderName, MusicProvider>();

export function selectMusicProvider(
  env: SelectProviderEnv = process.env as SelectProviderEnv,
): MusicProvider {
  const name = resolveProviderName(env);
  const cached = cache.get(name);
  if (cached) return cached;

  const provider =
    name === MOCK_PROVIDER_NAME ? createMockProvider() : createVolcengineProvider();
  cache.set(name, provider);
  return provider;
}

/** Test seam — drops memoised instances. */
export function resetMusicProviderCache(): void {
  cache.clear();
}

export { MOCK_PROVIDER_NAME, VOLCENGINE_PROVIDER_NAME };
