import { Controller, HttpCode, HttpStatus } from '@nestjs/common'

@Controller('task')
export class TaskController {
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  stub(): void {
    // TODO: Add task routes.
  }
}
