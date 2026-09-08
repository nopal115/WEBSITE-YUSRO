import { Controller, HttpCode, HttpStatus } from '@nestjs/common'

@Controller('content')
export class ContentController {
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  stub(): void {
    // TODO: Add content routes.
  }
}
