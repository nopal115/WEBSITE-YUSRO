import { ContentStatus, TaskType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateTaskOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

export class CreateTaskQuestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  prompt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  order!: number;

  @IsOptional()
  @IsUUID()
  audioId?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateTaskOptionDto)
  options!: CreateTaskOptionDto[];
}

export class CreateTaskDto {
  @IsUUID()
  stageId!: string;

  @IsOptional()
  @IsUUID()
  materialId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title!: string;

  @IsEnum(TaskType)
  type!: TaskType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  order!: number;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsUUID()
  referenceAudioId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTaskQuestionDto)
  questions?: CreateTaskQuestionDto[];
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order?: number;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsUUID()
  materialId?: string | null;

  @IsOptional()
  @IsUUID()
  referenceAudioId?: string | null;
}

export class AdminTaskQueryDto {
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;
}

export class OptionInputDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsBoolean()
  isCorrect!: boolean;
}

export class AddQuestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  prompt!: string;

  @IsOptional()
  @IsUUID()
  audioId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order?: number;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => OptionInputDto)
  options!: OptionInputDto[];
}

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  prompt?: string;

  @IsOptional()
  @IsUUID()
  audioId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => OptionInputDto)
  options?: OptionInputDto[];
}
