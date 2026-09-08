import { Controller, HttpCode, HttpStatus } from '@nestjs/common'

@Controller('user')
export class UserController {
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  stub(): void {
    // TODO: Add user routes.
  }
}
