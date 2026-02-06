import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
  ValidateNested,
} from 'class-validator';

export class PresignFileDto {
  // keep it strict to avoid generating keys for unexpected content
  @IsString()
  @Matches(/^image\/(jpeg|png|webp|heic|heif)$/)
  contentType: string;
}

export class CreatePresignedUrlsDto {
  // for batch uploads we expect a real album id
  @IsMongoId()
  albumId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PresignFileDto)
  files: PresignFileDto[];

  // optional override; keep bounded server-side
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(600)
  expiresInSeconds?: number;
}

