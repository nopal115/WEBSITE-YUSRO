import { Controller, HttpCode, HttpStatus } from '@nestjs/common'

@Controller('quiz')
export class QuizController {
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  stub(): void {
    // TODO: Add quiz routes.
  }
}
