import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import formbody from '@fastify/formbody';

import type { AppConfig } from './config';
import type { Dependencies } from './deps';
import { HttpError } from './utils/httpError';
import { rateLimitHook } from './middleware/rateLimit';
import { registerHealthRoutes } from './routes/health';
import { registerRoomRoutes } from './routes/rooms';
import { registerFileRoutes } from './routes/files';

export function createServer(config: AppConfig, deps: Dependencies) {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  app.register(cors, { origin: true });
  app.register(compress, { global: true });
  app.register(formbody);

  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body) {
      done(null, {});
      return;
    }

    try {
      done(null, JSON.parse(body));
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  app.addHook('onRequest', rateLimitHook(deps.redis));

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      reply.status(error.status).send({ error: error.message });
      return;
    }

    app.log.error({ err: error }, 'Unhandled error');
    reply.status(500).send({ error: 'internal server error' });
  });

  app.register(registerHealthRoutes);
  app.register((instance) => registerRoomRoutes(instance, config, deps));
  app.register((instance) => registerFileRoutes(instance, config, deps));

  return app;
}
