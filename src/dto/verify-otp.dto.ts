import { IsString, IsOptional, IsEmail } from 'class-validator';

export class VerifyOtpDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  otp: string;
}
