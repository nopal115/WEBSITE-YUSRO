import { Module } from '@nestjs/common';
import { AudioModule } from './modules/audio/audio.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContentModule } from './modules/content/content.module';
import { EvaluationModule } from './modules/evaluation/evaluation.module';
import { HealthModule } from './health/health.module';
import { ImitationModule } from './modules/imitation/imitation.module';
import { LearningModule } from './modules/learning/learning.module';
import { MlClientModule } from './modules/ml-client/ml-client.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { ProfileModule } from './modules/profile/profile.module';
import { ProgressModule } from './modules/progress/progress.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { ReportModule } from './modules/report/report.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { StudentAdminModule } from './modules/student-admin/student-admin.module';
import { TaskModule } from './modules/task/task.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [AuthModule, UserModule, ProfileModule, ContentModule, AudioModule, TaskModule, LearningModule, QuizModule, ImitationModule, EvaluationModule, MlClientModule, ProgressModule, StatisticsModule, ReportModule, StudentAdminModule, MonitoringModule, HealthModule],
})
export class AppModule {}
