import { IsEnum, IsOptional, IsString, MaxLength, IsBoolean } from 'class-validator';
import { ReflectionReason } from '../../../models/reflection.schema';

export class ReflectMediaDto {
  @IsEnum(ReflectionReason, {
    message: 'Reason must be one of: composition, moment, emotion, story',
  })
  reason: ReflectionReason;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Note must be at most 50 characters' })
  note?: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}
