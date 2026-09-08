import { Module } from '@nestjs/common'
import { AuthModule } from './modules/auth/auth.module'
import { UserModule } from './modules/user/user.module'
import { ProfileModule } from './modules/profile/profile.module'
import { ContentModule } from './modules/content/content.module'
import { AudioModule } from './modules/audio/audio.module'
import { TaskModule } from './modules/task/task.module'
import { LearningModule } from './modules/learning/learning.module'
import { QuizModule } from './modules/quiz/quiz.module'
import { ImitationModule } from './modules/imitation/imitation.module'
import { EvaluationModule } from './modules/evaluation/evaluation.module'
import { MlClientModule } from './modules/ml-client/ml-client.module'
import { ProgressModule } from './modules/progress/progress.module'
import { StatisticsModule } from './modules/statistics/statistics.module'
import { ReportModule } from './modules/report/report.module'
import { StudentAdminModule } from './modules/student-admin/student-admin.module'
import { MonitoringModule } from './modules/monitoring/monitoring.module'

@Module({
  imports: [
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
  ],
})
export class AppModule {}
