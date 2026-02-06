import { IsEmail, IsOptional, IsString } from 'class-validator';

export class RequestOtpDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
