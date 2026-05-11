import { PrismaClient } from '@prisma/client';
import { S3Client } from '@aws-sdk/client-s3';
import Redis from 'ioredis';

import { config } from './config';

export type Dependencies = {
  prisma: PrismaClient;
  redis: Redis;
  s3: S3Client;
};

export function createDependencies(): Dependencies {
  const prisma = new PrismaClient({
    datasourceUrl: config.DATABASE_URL,
  });

  const redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 2,
  });

  const s3 = new S3Client({
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  return { prisma, redis, s3 };
}
