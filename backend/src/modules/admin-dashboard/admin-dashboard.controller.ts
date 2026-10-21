import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@Controller('admin/dashboard')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminDashboardController {
	constructor(private readonly adminDashboardService: AdminDashboardService) {}

	@Get()
	getDashboard() {
		return this.adminDashboardService.getDashboard();
	}

	@Get('attention')
	getAttention() {
		return this.adminDashboardService.getAttention();
	}
}
