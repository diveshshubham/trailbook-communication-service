import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RequestOtpDto } from '../../dto/request-otp.dto';
import { VerifyOtpDto } from '../../dto/verify-otp.dto';
import { ApiResponse } from '../../utils/api-response';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('request-otp')
  async requestOtp(@Body() dto: RequestOtpDto) {
    await this.authService.requestOtp(dto);
    return ApiResponse.success('OTP sent successfully');
  }

  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(dto);
    return ApiResponse.success('OTP verified successfully', result);
  }
}
