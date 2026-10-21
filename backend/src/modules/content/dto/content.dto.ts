import { ContentStatus } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateStageDto {
  @IsString()
  @IsNotEmpty({ message: 'Judul tahapan wajib diisi.' })
  @MaxLength(150, { message: 'Judul tahapan maksimal 150 karakter.' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Deskripsi maksimal 2000 karakter.' })
  description?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

export class UpdateStageDto {
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Judul tahapan maksimal 150 karakter.' })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Deskripsi maksimal 2000 karakter.' })
  description?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

export class CreateMaterialDto {
  @IsString()
  @IsNotEmpty({ message: 'Tahapan wajib dipilih.' })
  stageId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Judul materi wajib diisi.' })
  @MaxLength(200, { message: 'Judul materi maksimal 200 karakter.' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Ringkasan materi maksimal 2000 karakter.' })
  summary?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Judul materi maksimal 200 karakter.' })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Ringkasan materi maksimal 2000 karakter.' })
  summary?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

export class ReorderDto {
  @IsArray()
  orderedIds!: string[];
}

export class SaveBlocksDto {
  @IsArray()
  blocks!: any[];
}
