import { ArrayUnique, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMediaTagsDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];
}

