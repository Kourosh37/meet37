/*
Frontend architecture note

File: src\lib\utils\fileChunker.ts
Layer: Frontend Foundation

Responsibility:
- Frontend file for the Frontend Foundation layer. It should implement only the responsibility implied by its route/feature name and should stay aligned with docs/ARCHITECTURE.md.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: keep this file aligned with backend/docs/API.md and backend/docs/WEBSOCKET.md when it touches server data or signaling.

State model to plan: loading, ready, empty, recoverable error, fatal error, and cleanup/unmount behavior where applicable.

UX and edge cases to plan:
- Display clear loading and empty states instead of rendering nothing once implementation starts.
- Normalize backend errors into user-safe messages while preserving technical details for logger.ts.
- Keep room links shareable; never require global login just to open an existing meeting link.
- In private app mode, require login only for room creation, not for joining a shared room link.
- Every meeting participant must provide a non-empty display name before joining.

Security and privacy notes:
- Never expose refresh tokens to arbitrary components; use the storage/auth layer only.
- Treat host_token as room-scoped moderation authority and avoid leaking it into URLs or logs.
- Do not persist raw media streams, SDP blobs, ICE candidates, or file bytes unless a later backend feature explicitly requires it.

Future tests: success path, loading path, error path, accessibility expectations, and cleanup/side-effect boundaries.

*/

import type { FileChunk } from "@/features/meeting/types/file";

export const DEFAULT_FILE_CHUNK_SIZE = 64 * 1024;
export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

export function assertFilePolicy(file: Blob) {
  if (file.size <= 0) {
    throw new Error("File is empty");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("File is larger than the 500 MB limit");
  }
}

async function readBlobSlice(blob: Blob) {
  if ("arrayBuffer" in blob && typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file chunk"));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }

      reject(new Error("File chunk reader returned an unexpected result"));
    };
    reader.readAsArrayBuffer(blob);
  });
}

export async function* chunkBlob(
  fileId: string,
  blob: Blob,
  chunkSize = DEFAULT_FILE_CHUNK_SIZE
): AsyncGenerator<FileChunk> {
  assertFilePolicy(blob);

  const totalChunks = Math.ceil(blob.size / chunkSize);

  for (let index = 0; index < totalChunks; index += 1) {
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize, blob.size);
    const bytes = await readBlobSlice(blob.slice(start, end));

    yield {
      bytes,
      fileId,
      index,
      totalChunks
    };
  }
}

export function reassembleChunks(
  chunks: FileChunk[],
  mime = "application/octet-stream"
) {
  const sorted = [...chunks].sort((left, right) => left.index - right.index);
  return new Blob(
    sorted.map((chunk) => new Uint8Array(chunk.bytes)),
    { type: mime }
  );
}
