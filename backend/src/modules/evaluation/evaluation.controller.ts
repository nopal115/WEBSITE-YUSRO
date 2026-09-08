import { Controller, HttpCode, HttpStatus } from '@nestjs/common'

@Controller('evaluation')
export class EvaluationController {
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  stub(): void {
    // TODO: Add evaluation routes.
  }
}
