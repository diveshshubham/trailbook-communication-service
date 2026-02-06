import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfilePictureDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  profilePicture: string; // S3 key
}

