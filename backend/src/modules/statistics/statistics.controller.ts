import { Controller, HttpCode, HttpStatus } from '@nestjs/common'

@Controller('statistics')
export class StatisticsController {
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  stub(): void {
    // TODO: Add statistics routes.
  }
}
