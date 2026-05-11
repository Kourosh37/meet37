import { GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

import type { AppConfig } from '../config';
import { sanitizeFilename } from '../utils/sanitizeFilename';

export type UploadUrls = {
  fileId: string;
  uploadUrl: string;
  downloadUrl: string;
};

export async function createUploadUrls(
  config: AppConfig,
  s3: S3Client,
  filename: string,
  size: number,
): Promise<UploadUrls> {
  const fileId = randomUUID();
  const cleanFilename = sanitizeFilename(filename);
  const objectKey = `uploads/${fileId}-${cleanFilename}`;

  const uploadCommand = new PutObjectCommand({
    Bucket: config.S3_BUCKET,
    Key: objectKey,
    ContentLength: size,
  });

  const downloadCommand = new GetObjectCommand({
    Bucket: config.S3_BUCKET,
    Key: objectKey,
  });

  const uploadUrl = await getSignedUrl(s3, uploadCommand, { expiresIn: 300 });
  const downloadUrl = await getSignedUrl(s3, downloadCommand, { expiresIn: 3600 });

  return { fileId, uploadUrl, downloadUrl };
}
