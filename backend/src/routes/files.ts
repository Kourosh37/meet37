import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config';
import type { Dependencies } from '../deps';
import { badRequest, externalError } from '../utils/httpError';
import { createUploadUrls } from '../services/uploads';

export async function registerFileRoutes(app: FastifyInstance, config: AppConfig, deps: Dependencies) {
  app.post('/files/upload-url', async (request) => {
    const payload = request.body as { filename?: string; size?: number } | undefined;
    const filename = String(payload?.filename ?? '').trim();
    const size = Number(payload?.size ?? 0);

    if (!filename) {
      throw badRequest('`filename` is required');
    }
    if (!Number.isFinite(size) || size <= 0) {
      throw badRequest('`size` must be a positive number');
    }

    try {
      return await createUploadUrls(config, deps.s3, filename, size);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to create upload URL';
      throw externalError(message);
    }
  });
}
