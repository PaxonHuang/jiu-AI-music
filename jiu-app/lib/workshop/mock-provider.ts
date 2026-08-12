// Credential-free `MusicProvider` for local development and tests.
//
// `next dev` does not read .dev.vars (that is a wrangler-only file), so
// without this the workshop is unusable outside `wrangler dev`. Tasks here
// advance on a timer so the polling UI exercises the real pending -> running
// -> success path instead of resolving instantly.

import {
  MusicProviderError,
  type CreateMusicTaskInput,
  type CreateMusicTaskResult,
  type MusicProvider,
  type MusicTaskState,
} from './types.ts';

export const MOCK_PROVIDER_NAME = 'mock';

/** Public sample used as the stand-in result. */
const DEFAULT_SAMPLE_AUDIO_URL = '/audio/sample-song.mp3';

/** Wall-clock ms before a mock task reports success. */
const DEFAULT_DURATION_MS = 6000;

interface MockTask {
  input: CreateMusicTaskInput;
  createdAt: number;
}

export function createMockProvider(options: {
  sampleAudioUrl?: string;
  durationMs?: number;
  /** Injectable clock; defaults to Date.now. */
  now?: () => number;
} = {}): MusicProvider {
  const sampleAudioUrl = options.sampleAudioUrl ?? DEFAULT_SAMPLE_AUDIO_URL;
  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
  const now = options.now ?? (() => Date.now());
  const tasks = new Map<string, MockTask>();
  let counter = 0;

  return {
    name: MOCK_PROVIDER_NAME,

    async createTask(input: CreateMusicTaskInput): Promise<CreateMusicTaskResult> {
      counter += 1;
      const taskId = `mock-${now().toString(36)}-${counter}`;
      tasks.set(taskId, { input, createdAt: now() });
      return { taskId, predictedWaitTime: Math.round(durationMs / 1000) };
    },

    async getTask(taskId: string): Promise<MusicTaskState> {
      const task = tasks.get(taskId);
      if (!task) {
        // Matches how a real vendor answers for an unknown id.
        throw new MusicProviderError({
          code: 404,
          message: `Unknown mock task: ${taskId}`,
          action: 'QuerySong',
          requestId: 'mock-request',
          provider: MOCK_PROVIDER_NAME,
        });
      }

      const elapsed = now() - task.createdAt;
      const ratio = durationMs === 0 ? 1 : Math.min(elapsed / durationMs, 1);

      if (ratio >= 1) {
        return {
          taskId,
          status: 'success',
          progress: 100,
          audioUrl: sampleAudioUrl,
          lyrics: task.input.lyrics ?? task.input.prompt ?? '',
          duration: 60,
          failure: null,
        };
      }

      return {
        taskId,
        status: ratio === 0 ? 'pending' : 'running',
        progress: Math.floor(ratio * 100),
        failure: null,
      };
    },
  };
}
