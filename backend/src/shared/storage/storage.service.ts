import { Injectable } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly isLocal = process.env.STORAGE_DRIVER === 'local' || (!process.env.S3_ENDPOINT && !process.env.S3_ACCESS_KEY);
  private readonly localDir = path.resolve(process.env.STORAGE_LOCAL_DIR ?? path.join(process.cwd(), 'uploads'));
  private readonly bucket = process.env.S3_BUCKET ?? 'yusro-audio';
  private readonly client = new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY
      ? { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY }
      : undefined,
  });

  async putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
    if (this.isLocal) {
      const filePath = path.join(this.localDir, key);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, body);
      return;
    }
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
  }

  async getObject(key: string): Promise<Uint8Array> {
    if (this.isLocal) {
      const filePath = path.join(this.localDir, key);
      const data = await fs.promises.readFile(filePath);
      return new Uint8Array(data);
    }
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error('Stored audio has no body');
    return result.Body.transformToByteArray();
  }

  async deleteObject(key: string): Promise<void> {
    if (this.isLocal) {
      const filePath = path.join(this.localDir, key);
      try {
        await fs.promises.unlink(filePath);
      } catch {
        // ignore if not found
      }
      return;
    }
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getSignedGetUrl(key: string, expiresInSeconds = 900): Promise<string> {
    if (this.isLocal) {
      return `/api/v1/audio/local/${encodeURIComponent(key)}`;
    }
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }
}
