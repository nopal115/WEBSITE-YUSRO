import { Controller, HttpCode, HttpStatus } from '@nestjs/common'

@Controller('imitation')
export class ImitationController {
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  stub(): void {
    // TODO: Add imitation routes.
  }
}
