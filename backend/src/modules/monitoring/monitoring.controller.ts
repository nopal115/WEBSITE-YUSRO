import { Controller, HttpCode, HttpStatus } from '@nestjs/common'

@Controller('monitoring')
export class MonitoringController {
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  stub(): void {
    // TODO: Add monitoring routes.
  }
}
