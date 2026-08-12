// Vendor-neutral contract for AI music generation.
//
// Everything above this layer (the /api/music/* routes) speaks these types;
// only the provider implementations know about a specific vendor's wire
// format. Swapping Volcengine for another vendor means adding one file that
// implements `MusicProvider` — no route changes.
//
// Deliberately excluded from this contract:
//   * audio persistence (R2) — a storage concern, handled by the route
//   * credentials — each implementation loads its own

export type MusicTrack = 'vocal' | 'instrumental';

export type MusicTaskStatus = 'pending' | 'running' | 'success' | 'failed';

export type VoiceGender = 'Female' | 'Male';

export type MusicModelVersion = 'v4.0' | 'v4.3' | 'v5.0';

export type AudioFormat = 'wav' | 'mp3';

export interface CreateMusicTaskInput {
  track: MusicTrack;
  /** Instrumental only: description of the piece to generate. */
  text?: string;
  /** Vocal only: explicit lyrics. Mutually exclusive with `prompt`. */
  lyrics?: string;
  /** Vocal only: free-form idea; the vendor writes the lyrics. */
  prompt?: string;
  /** Chinese label, e.g. "流行". */
  genre?: string;
  /** Chinese label, e.g. "开心". */
  mood?: string;
  gender?: VoiceGender;
  timbre?: string;
  /** Chinese labels, at most 2. */
  instruments?: string[];
  duration?: number;
  modelVersion?: MusicModelVersion;
  lang?: string;
  vodFormat?: AudioFormat;
  callbackUrl?: string;
}

export interface CreateMusicTaskResult {
  taskId: string;
  /** Seconds the vendor expects the job to take; 0 when unknown. */
  predictedWaitTime: number;
}

export interface MusicTaskState {
  taskId: string;
  status: MusicTaskStatus;
  /** 0-100. */
  progress: number;
  /** Present once `status === 'success'`. */
  audioUrl?: string;
  lyrics?: string;
  duration?: number;
  /** Present only when `status === 'failed'`. */
  failure: MusicTaskFailure | null;
}

export interface MusicTaskFailure {
  code: number;
  message: string;
}

// Normalised provider error. `code` is the vendor's numeric error code, which
// the routes map to a child-friendly Chinese message.
//
// Fields are declared explicitly rather than via constructor parameter
// properties, which Node's --experimental-strip-types mode rejects.
export class MusicProviderError extends Error {
  readonly code: number;
  readonly action: string;
  readonly requestId: string;
  readonly provider: string;

  constructor(options: {
    code: number;
    message: string;
    action: string;
    requestId: string;
    provider: string;
  }) {
    super(options.message);
    this.name = 'MusicProviderError';
    this.code = options.code;
    this.action = options.action;
    this.requestId = options.requestId;
    this.provider = options.provider;
  }
}

export interface MusicProvider {
  /** Stable identifier, surfaced in logs and API responses. */
  readonly name: string;
  createTask(input: CreateMusicTaskInput): Promise<CreateMusicTaskResult>;
  getTask(taskId: string): Promise<MusicTaskState>;
}
