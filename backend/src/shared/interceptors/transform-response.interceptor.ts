import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

export interface ResponseEnvelope<T = unknown> {
  success: true;
  message: string;
  data: T;
  meta: unknown | null;
  requestId: string;
  timestamp: string;
}

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<T, ResponseEnvelope<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseEnvelope<T> | T> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const rawRequestId = request?.headers?.['x-request-id'];
    const requestId = (Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId) || randomUUID();

    if (response?.setHeader) {
      response.setHeader('X-Request-Id', requestId);
    }

    return next.handle().pipe(
      map((payload: any) => {
        // Biarkan stream, buffer, atau berkas biner (misal PDF) lewat tanpa pembungkus JSON
        if (
          payload instanceof StreamableFile ||
          Buffer.isBuffer(payload) ||
          payload instanceof Uint8Array ||
          (response?.getHeader && response.getHeader('content-type')?.toString().includes('application/pdf'))
        ) {
          return payload;
        }

        const timestamp = new Date().toISOString();

        // Bila controller sudah mengembalikan struktur amplop SDD 5.5
        if (payload && typeof payload === 'object' && payload.success === true && 'data' in payload) {
          return {
            ...payload,
            meta: payload.meta ?? null,
            requestId: payload.requestId || requestId,
            timestamp: payload.timestamp || timestamp,
          };
        }

        let message = 'Berhasil';
        let data: any = payload;
        let meta: any = null;

        if (payload && typeof payload === 'object') {
          // Bila data memiliki pesan khusus
          if (typeof payload.message === 'string') {
            message = payload.message;
          }

          // Bila payload memuat data berpaginasi { data, meta } atau { items, meta }
          if ('data' in payload && 'meta' in payload) {
            data = payload.data;
            meta = payload.meta;
          } else if ('items' in payload && 'meta' in payload) {
            data = payload.items;
            meta = payload.meta;
          }
        }

        return {
          success: true,
          message,
          data: data ?? null,
          meta: meta ?? null,
          requestId,
          timestamp,
        };
      }),
    );
  }
}
