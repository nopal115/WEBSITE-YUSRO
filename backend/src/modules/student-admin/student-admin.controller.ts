import { Controller, HttpCode, HttpStatus } from '@nestjs/common'

@Controller('student-admin')
export class StudentAdminController {
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  stub(): void {
    // TODO: Add student administration routes.
  }
}
