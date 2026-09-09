import { Module } from '@nestjs/common';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';
// SDD 3.9 - Quiz Module
@Module({ controllers: [QuizController], providers: [QuizService] })
export class QuizModule {}
