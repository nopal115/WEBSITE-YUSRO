import { Controller, HttpCode, HttpStatus } from '@nestjs/common'

@Controller('ml-client')
export class MlClientController {
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  stub(): void {
    // TODO: Add ML client routes.
  }
}
