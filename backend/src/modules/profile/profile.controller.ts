import { Controller, HttpCode, HttpStatus } from '@nestjs/common'

@Controller('profile')
export class ProfileController {
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  stub(): void {
    // TODO: Add profile routes.
  }
}
