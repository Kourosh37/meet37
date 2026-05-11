import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config';
import type { Dependencies } from '../deps';
import { badRequest, notFound } from '../utils/httpError';
import { createRoomToken, normalizeToken, roomExists } from '../services/rooms';
import { createLivekitToken } from '../services/livekit';

export async function registerRoomRoutes(app: FastifyInstance, config: AppConfig, deps: Dependencies) {
  app.post('/rooms', async (_, reply) => {
    const token = await createRoomToken(deps.prisma, deps.redis);
    reply.code(201);
    return { token };
  });

  app.get('/rooms/:token', async (request) => {
    const rawToken = (request.params as { token: string }).token;
    const token = normalizeToken(rawToken);
    if (!token) throw badRequest('room token is required');

    const exists = await roomExists(deps.prisma, deps.redis, token);
    if (!exists) {
      throw notFound(`room \`${token}\` was not found`);
    }

    return { exists: true };
  });

  app.post('/rooms/:token/join', async (request) => {
    const rawToken = (request.params as { token: string }).token;
    const token = normalizeToken(rawToken);
    if (!token) throw badRequest('room token is required');

    const displayName = String((request.body as { displayName?: string } | undefined)?.displayName ?? '').trim();
    if (!displayName) {
      throw badRequest('`displayName` cannot be empty');
    }
    if (displayName.length > 64) {
      throw badRequest('`displayName` must be 64 characters or less');
    }

    const exists = await roomExists(deps.prisma, deps.redis, token);
    if (!exists) {
      throw notFound(`room \`${token}\` was not found`);
    }

    const livekitToken = createLivekitToken(config, token, displayName);
    return { livekitToken };
  });
}
