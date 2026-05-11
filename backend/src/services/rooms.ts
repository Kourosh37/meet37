import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { Prisma } from '@prisma/client';

import { generateRoomToken } from '../utils/token';

const ROOM_CACHE_TTL_SECONDS = 3600;

export async function createRoomToken(prisma: PrismaClient, redis: Redis): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generateRoomToken();

    try {
      await prisma.room.create({
        data: { token },
      });
      await cacheRoom(redis, token);
      return token;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        continue;
      }
      throw error;
    }
  }

  throw new Error('room token collision');
}

export async function roomExists(prisma: PrismaClient, redis: Redis, token: string): Promise<boolean> {
  const normalized = normalizeToken(token);

  if (await isRoomCached(redis, normalized)) {
    return true;
  }

  const room = await prisma.room.findUnique({
    where: { token: normalized },
    select: { token: true },
  });

  if (room) {
    await cacheRoom(redis, normalized);
    return true;
  }

  return false;
}

export function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

async function isRoomCached(redis: Redis, token: string): Promise<boolean> {
  const key = roomCacheKey(token);
  try {
    const cached = await redis.get(key);
    return Boolean(cached);
  } catch {
    return false;
  }
}

async function cacheRoom(redis: Redis, token: string): Promise<void> {
  const key = roomCacheKey(token);
  try {
    await redis.set(key, '1', 'EX', ROOM_CACHE_TTL_SECONDS);
  } catch {
    // Cache failure should not block room creation.
  }
}

function roomCacheKey(token: string): string {
  return `room:exists:${token}`;
}
