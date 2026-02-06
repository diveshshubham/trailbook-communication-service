import { IsMongoId, IsString, MinLength } from 'class-validator';

export class DeleteS3ObjectDto {
  @IsMongoId()
  albumId: string;

  /** S3 object key, e.g. albums/{albumId}/{uuid}.jpeg */
  @IsString()
  @MinLength(1)
  key: string;
}
