import { AccessToken } from 'livekit-server-sdk';
import { randomUUID } from 'crypto';

import type { AppConfig } from '../config';

export function createLivekitToken(config: AppConfig, room: string, displayName: string): string {
  const identity = `participant-${randomUUID().replace(/-/g, '')}`;

  const token = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
    identity,
    name: displayName,
  });

  token.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return token.toJwt();
}
