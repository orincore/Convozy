import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);

/**
 * Every audio upload is normalized to one canonical shape — AAC-LC in an
 * MP4 container, `moov` atom moved to the front via `-movflags +faststart`
 * — regardless of what the creator uploaded (wav/aac/mp3/m4a).
 *
 * Real-world necessity, not gold-plating: Apple's Voice Memos app — the
 * single most common source of a creator's "voice note" recording — exports
 * `.m4a` files with the `moov` atom at the END of the file (non-faststart).
 * Meta's Send API fetches the attachment URL and fails that fetch/ingest
 * step with a generic "upload failed" (IGApiException error_subcode
 * 2018007) for exactly that file shape, even though m4a itself is a
 * documented-supported format — reproduced against the real production
 * Graph API (same account, same recipient), then confirmed a
 * faststart-remuxed copy of the identical audio sent successfully.
 *
 * Re-encoding through ffmpeg (not just remuxing the container) also
 * sidesteps whatever other undocumented codec/profile quirk a source file
 * might carry, and lets mp3 input — not itself a Meta-documented format,
 * confirmed via a clean "format not supported" rejection (error_subcode
 * 2534080) on a raw mp3 send — become a real, working voice note instead of
 * a best-effort upload that silently fails at send time.
 */
export async function normalizeAudioToM4a(buffer: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'convozy-audio-'));
  const inputPath = join(dir, `${randomUUID()}.input`);
  const outputPath = join(dir, `${randomUUID()}.m4a`);

  try {
    await writeFile(inputPath, buffer);
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ar',
      '44100',
      '-ac',
      '1',
      '-movflags',
      '+faststart',
      outputPath,
    ]);
    return await readFile(outputPath);
  } catch (err) {
    throw new Error(`ffmpeg audio normalization failed: ${(err as Error).message}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
