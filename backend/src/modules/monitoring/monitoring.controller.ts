import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Get as HttpGet } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';

@Controller('monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class MonitoringController {
	constructor(private readonly monitoringService: MonitoringService) {}

	@Get()
	getStatus() {
		return this.monitoringService.getStatus();
	}

	@HttpGet('students')
	getStudents() {
		return this.monitoringService.getStudents();
	}
}
