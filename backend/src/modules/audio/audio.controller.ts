import { Controller, HttpCode, HttpStatus } from '@nestjs/common'

@Controller('audio')
export class AudioController {
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  stub(): void {
    // TODO: Add audio routes.
  }
}
