// Volcengine implementation of `MusicProvider`.
//
// This is the only place that knows Volcengine's action names, PascalCase
// response fields, and numeric status codes. It wraps lib/volcengine/{sign,
// gensong}.ts rather than reimplementing them — that V4 signing chain is
// verified by its own unit tests.

import { loadCredentials, type LoadedCredentials } from '../volcengine/sign.ts';
import {
  querySong,
  submitGenBGMForTime,
  submitGenSongForTime,
  VolcApiError,
  STATUS_PENDING,
  STATUS_RUNNING,
  STATUS_SUCCESS,
  STATUS_FAILED,
  type SongStatus,
} from '../volcengine/gensong.ts';
import {
  MusicProviderError,
  type CreateMusicTaskInput,
  type CreateMusicTaskResult,
  type MusicProvider,
  type MusicTaskState,
} from './types.ts';

export const VOLCENGINE_PROVIDER_NAME = 'volcengine';

const STATUS_MAP: Record<SongStatus, MusicTaskState['status']> = {
  [STATUS_PENDING]: 'pending',
  [STATUS_RUNNING]: 'running',
  [STATUS_SUCCESS]: 'success',
  [STATUS_FAILED]: 'failed',
};

export function createVolcengineProvider(options: {
  credentials?: LoadedCredentials;
} = {}): MusicProvider {
  // Resolved once per provider instance so a missing key fails at selection
  // time rather than mid-request.
  const credentials = options.credentials ?? loadCredentials();

  return {
    name: VOLCENGINE_PROVIDER_NAME,

    async createTask(input: CreateMusicTaskInput): Promise<CreateMusicTaskResult> {
      try {
        if (input.track === 'instrumental') {
          const submitted = await submitGenBGMForTime(
            {
              text: input.text ?? '',
              duration: input.duration,
              callbackUrl: input.callbackUrl,
              enableInputRewrite: false,
              instruments: input.instruments,
            },
            credentials,
          );
          return { taskId: submitted.taskId, predictedWaitTime: submitted.predictedWaitTime };
        }

        const submitted = await submitGenSongForTime(
          {
            lyrics: input.lyrics,
            prompt: input.prompt,
            modelVersion: input.modelVersion,
            genre: input.genre,
            mood: input.mood,
            gender: input.gender,
            timbre: input.timbre,
            duration: input.duration,
            lang: input.lang,
            vodFormat: input.vodFormat,
            instruments: input.instruments,
            callbackUrl: input.callbackUrl,
          },
          credentials,
        );
        return { taskId: submitted.taskId, predictedWaitTime: submitted.predictedWaitTime };
      } catch (err) {
        throw toProviderError(err);
      }
    },

    async getTask(taskId: string): Promise<MusicTaskState> {
      try {
        const result = await querySong(taskId, credentials);
        return {
          taskId: result.taskId,
          status: STATUS_MAP[result.status] ?? 'pending',
          progress: result.progress,
          audioUrl: result.status === STATUS_SUCCESS ? result.audioUrl : undefined,
          lyrics: result.lyrics,
          duration: result.duration,
          failure:
            result.status === STATUS_FAILED && result.failureReason
              ? { code: result.failureReason.code, message: result.failureReason.msg }
              : null,
        };
      } catch (err) {
        throw toProviderError(err);
      }
    },
  };
}

function toProviderError(err: unknown): unknown {
  if (err instanceof VolcApiError) {
    return new MusicProviderError({
      code: err.code,
      message: err.message,
      action: err.action,
      requestId: err.requestId,
      provider: VOLCENGINE_PROVIDER_NAME,
    });
  }
  return err;
}
