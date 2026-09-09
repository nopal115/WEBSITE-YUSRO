import { Module } from '@nestjs/common';
import { StudentAdminController } from './student-admin.controller';
import { StudentAdminService } from './student-admin.service';
// SDD 3.16 - Student Admin Module
@Module({ controllers: [StudentAdminController], providers: [StudentAdminService] })
export class StudentAdminModule {}
