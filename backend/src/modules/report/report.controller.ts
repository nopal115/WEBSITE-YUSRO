import { Controller, HttpCode, HttpStatus } from '@nestjs/common'

@Controller('report')
export class ReportController {
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  stub(): void {
    // TODO: Add report routes.
  }
}
