import { FeedbackCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GradeSubmissionDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Nilai harus berupa angka antara 0 dan 100.' })
  @Min(0, { message: 'Nilai minimal adalah 0.' })
  @Max(100, { message: 'Nilai maksimal adalah 100.' })
  score!: number;

  @IsOptional()
  @IsEnum(FeedbackCategory, { message: 'Kategori predikat tidak valid.' })
  feedbackCategory?: FeedbackCategory;

  @IsOptional()
  @IsString({ message: 'Catatan masukan harus berupa teks.' })
  notes?: string;
}
