import { Controller, HttpCode, HttpStatus } from '@nestjs/common'

@Controller('learning')
export class LearningController {
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  stub(): void {
    // TODO: Add learning routes.
  }
}
