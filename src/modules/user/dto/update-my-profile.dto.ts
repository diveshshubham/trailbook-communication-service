import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateMyProfileDto {
  // Contact
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(30)
  phone?: string;

  // Alias: some clients use mobileNumber
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(30)
  mobileNumber?: string;

  // Profile details
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  bio?: string;

  // Alias: some clients use description
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  experience?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  website?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  // Favorites
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  favoriteAlbumIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  favoriteMediaIds?: string[];
}

