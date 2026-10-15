import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AudioModule } from './modules/audio/audio.module';
import { AuthModule } from './modules/auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { AudioProcessingModule } from './shared/audio/audio-processing.module';
import { BrowserModule } from './shared/browser/browser.module';
import { DatabaseModule } from './shared/database/database.module';
import { StorageModule } from './shared/storage/storage.module';

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    AudioProcessingModule,
    BrowserModule,
    AuthModule,
    UserModule,
    ProfileModule,
    ContentModule,
    AudioModule,
    TaskModule,
    LearningModule,
    QuizModule,
    ImitationModule,
    EvaluationModule,
    MlClientModule,
    ProgressModule,
    StatisticsModule,
    ReportModule,
    StudentAdminModule,
    MonitoringModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
