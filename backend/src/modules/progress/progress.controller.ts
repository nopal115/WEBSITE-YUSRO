import { Controller, HttpCode, HttpStatus } from '@nestjs/common'

@Controller('progress')
export class ProgressController {
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  stub(): void {
    // TODO: Add progress routes.
  }
}
