import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      status: 'ok',
      service: 'yusro-backend',
      message: 'NestJS backend is running',
    };
  }
}
