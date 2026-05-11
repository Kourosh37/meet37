import { config } from './config';
import { createDependencies } from './deps';
import { createServer } from './server';
import { verifyLivekitConfiguration } from './services/livekit';

const deps = createDependencies();
const app = createServer(config, deps);

const shutdown = async () => {
  app.log.info('Shutting down...');
  await app.close();
  await deps.prisma.$disconnect();
  await deps.redis.quit();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await verifyLivekitConfiguration(config);
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
