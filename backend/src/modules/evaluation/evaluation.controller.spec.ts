import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { EvaluationController } from './evaluation.controller';

describe('EvaluationController admin authorization', () => {
	const contextFor = (role: UserRole): ExecutionContext => ({
		getHandler: () => EvaluationController.prototype.retry,
		getClass: () => EvaluationController,
		switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
	} as unknown as ExecutionContext);

	it('rejects a Santri from retrying an evaluation', () => {
		const guard = new RolesGuard(new Reflector());
		expect(() => guard.canActivate(contextFor(UserRole.SANTRI))).toThrow('Insufficient role permissions');
	});

	it('allows an Admin to retry an evaluation', () => {
		const guard = new RolesGuard(new Reflector());
		expect(guard.canActivate(contextFor(UserRole.ADMIN))).toBe(true);
	});
});
