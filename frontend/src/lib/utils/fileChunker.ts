import type { FileChunk } from "@/features/meeting/types/file";

export const DEFAULT_FILE_CHUNK_SIZE = 64 * 1024;
export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

export function assertFilePolicy(file: Blob) {
  if (file.size <= 0) {
    throw new Error("error.fileEmpty");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("error.fileTooLarge");
  }
}

async function readBlobSlice(blob: Blob) {
  if ("arrayBuffer" in blob && typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () =>
      reject(reader.error ?? new Error("error.failedToReadFileChunk"));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }

      reject(new Error("error.unexpectedFileChunkResult"));
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
