import { randomBytes } from 'crypto';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generateRoomToken(length = 12): string {
  const bytes = randomBytes(length);
  let token = '';

  for (let i = 0; i < length; i += 1) {
    token += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return token;
}
