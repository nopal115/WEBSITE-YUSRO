import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

const ERROR_MESSAGE_MAP: Record<string, string> = {
  AUTH_EMAIL_TAKEN: 'Email sudah terdaftar. Gunakan email lain atau masuk.',
  AUTH_INVALID_CREDENTIALS: 'Email atau password salah.',
  AUTH_ACCOUNT_INACTIVE: 'Akun Anda dinonaktifkan. Hubungi pengajar.',
  AUTH_TOKEN_EXPIRED: 'Sesi berakhir. Silakan masuk kembali.',
  AUTH_REFRESH_REUSED: 'Sesi tidak valid. Silakan masuk kembali.',
  AUTH_RESET_INVALID: 'Tautan reset tidak berlaku. Silakan minta tautan baru.',
  AUTH_WEAK_PASSWORD: 'Password minimal 8 karakter dan memuat huruf serta angka.',
  USER_NOT_FOUND: 'Pengguna tidak ditemukan.',
  USER_INACTIVE: 'Akun Anda sedang tidak aktif.',
  FORBIDDEN_ROLE: 'Anda tidak memiliki hak akses untuk tindakan ini.',
  FORBIDDEN_RESOURCE: 'Data yang diminta tidak ditemukan atau Anda tidak memiliki akses.',
  CONTENT_NOT_FOUND: 'Konten tidak ditemukan.',
  CONTENT_INVALID_TRANSITION: 'Perubahan status konten tidak diperbolehkan.',
  CONTENT_IN_USE: 'Konten ini sudah pernah digunakan dalam aktivitas belajar sehingga tidak dapat dihapus.',
  CONTENT_REORDER_INCOMPLETE: 'Daftar urutan konten tidak lengkap.',
  LEARNING_MATERIAL_LOCKED: 'Materi ini belum terbuka. Selesaikan materi sebelumnya terlebih dahulu.',
  LEARNING_STAGE_LOCKED: 'Tahapan ini belum terbuka.',
  LEARNING_MATERIAL_INACTIVE: 'Materi ini sedang tidak tersedia.',
  QUIZ_ANSWERS_INCOMPLETE: 'Seluruh soal wajib dijawab.',
  QUIZ_OPTION_MISMATCH: 'Pilihan jawaban tidak sesuai dengan soal.',
  QUIZ_TASK_INACTIVE: 'Tugas ini sedang tidak aktif.',
  TASK_INCOMPLETE: 'Komponen tugas belum lengkap.',
  TASK_ANSWER_KEY_INVALID: 'Tugas harus memiliki tepat satu jawaban benar per soal.',
  TASK_REFERENCE_NOT_ACTIVE: 'Audio referensi tugas belum aktif.',
  TASK_IN_USE: 'Tugas ini sudah pernah dikerjakan sehingga tidak dapat dihapus.',
  TASK_INACTIVE: 'Tugas ini sedang tidak tersedia.',
  AUDIO_FORMAT_UNSUPPORTED: 'Format audio tidak didukung.',
  AUDIO_TOO_LARGE: 'Ukuran rekaman melebihi batas yang diizinkan.',
  AUDIO_DURATION_INVALID: 'Durasi rekaman harus antara 1 dan 60 detik.',
  AUDIO_UNREADABLE: 'Berkas rekaman tidak dapat dibaca. Silakan rekam ulang.',
  AUDIO_SILENT: 'Rekaman tidak terdengar. Pastikan mikrofon aktif, lalu rekam ulang.',
  AUDIO_STORAGE_ERROR: 'Penyimpanan sedang bermasalah. Coba beberapa saat lagi.',
  AUDIO_IN_USE_BY_SUBMISSION: 'Audio ini telah digunakan dalam riwayat pengerjaan.',
  IMITATION_ACTIVE_EXISTS: 'Masih ada rekaman yang sedang dievaluasi untuk tugas ini.',
  IMITATION_COOLDOWN: 'Tunggu beberapa detik sebelum mengirim rekaman berikutnya.',
  EVAL_RETRY_NOT_ALLOWED: 'Evaluasi ulang hanya dapat dilakukan pada pengiriman yang berstatus gagal.',
  REPORT_BUSY: 'Layanan pembuatan laporan sedang sibuk. Silakan coba lagi sebentar lagi.',
  RATE_LIMITED: 'Terlalu banyak permintaan. Silakan tunggu beberapa saat.',
  VALIDATION_ERROR: 'Data yang dikirim belum lengkap atau tidak valid.',
  INTERNAL_ERROR: 'Terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const rawRequestId = request?.headers?.['x-request-id'];
    const requestId = (Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId) || randomUUID();

    if (response?.setHeader) {
      response.setHeader('X-Request-Id', requestId);
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'Terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.';
    let errors: Array<{ field?: string; message: string }> | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        if (/^[A-Z0-9_]+$/.test(res)) {
          errorCode = res;
          message = ERROR_MESSAGE_MAP[errorCode] || res;
        } else {
          message = res;
          errorCode = this.fallbackErrorCode(status);
        }
      } else if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, any>;
        const detectedCode = body.errorCode || body.error_code || (typeof body.error === 'string' && /^[A-Z0-9_]+$/.test(body.error) ? body.error : undefined);

        if (detectedCode) {
          errorCode = detectedCode;
        } else {
          errorCode = this.fallbackErrorCode(status);
        }

        if (Array.isArray(body.message)) {
          errorCode = 'VALIDATION_ERROR';
          message = 'Data yang dikirim belum lengkap atau tidak valid.';
          errors = body.message.map((msgItem: unknown) => {
            const strMsg = String(msgItem);
            const firstWord = strMsg.split(' ')[0];
            return {
              field: firstWord,
              message: strMsg,
            };
          });
        } else if (typeof body.message === 'string') {
          if (ERROR_MESSAGE_MAP[body.message]) {
            errorCode = body.message;
            message = ERROR_MESSAGE_MAP[errorCode];
          } else if (ERROR_MESSAGE_MAP[errorCode]) {
            message = ERROR_MESSAGE_MAP[errorCode];
          } else {
            message = body.message;
          }
        } else if (ERROR_MESSAGE_MAP[errorCode]) {
          message = ERROR_MESSAGE_MAP[errorCode];
        }

        if (body.errors && Array.isArray(body.errors)) {
          errors = body.errors;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error [${requestId}]: ${exception.message}`, exception.stack);
      errorCode = 'INTERNAL_ERROR';
      message = 'Terjadi kesalahan pada server. Silakan coba lagi.';
    }

    // Hindari mengirimkan pesan internal bahasa Inggris bawaan NestJS jika ada padanan kode
    if (ERROR_MESSAGE_MAP[errorCode]) {
      message = ERROR_MESSAGE_MAP[errorCode];
    }

    const payload = {
      success: false,
      message,
      errorCode,
      ...(errors && errors.length > 0 ? { errors } : {}),
      requestId,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(payload);
  }

  private fallbackErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'AUTH_INVALID_CREDENTIALS';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN_RESOURCE';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return 'AUDIO_TOO_LARGE';
      case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
        return 'AUDIO_FORMAT_UNSUPPORTED';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_ERROR';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
