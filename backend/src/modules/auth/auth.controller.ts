import { Controller, HttpCode, HttpStatus } from '@nestjs/common'

@Controller('auth')
export class AuthController {
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  stub(): void {
    // TODO: Add authentication routes.
  }
}
