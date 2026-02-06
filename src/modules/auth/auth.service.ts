import { BadRequestException, Injectable } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../user/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  private getIdentifier(data: any) {
    return data.email || data.phone;
  }

  async requestOtp(data: any) {
    if (!data.email && !data.phone) {
      throw new BadRequestException('Email or phone required');
    }

    const identifier = this.getIdentifier(data);
    const rateKey = `otp:request:${identifier}`;

    const attempts = await this.redisService.incr(rateKey, 15 * 60);
    if (attempts > 5) {
      throw new BadRequestException('Too many OTP requests. Try later.');
    }

    const user = await this.usersService.upsertUser(data);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.usersService.updateOtp(user._id, otp, expiresAt);

    console.log('OTP:', otp);

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(data: any) {
    const identifier = this.getIdentifier(data);
    const verifyKey = `otp:verify:${identifier}`;
  
    const attempts = await this.redisService.incr(verifyKey, 5 * 60);
    if (attempts > 5) {
      throw new BadRequestException('Too many attempts');
    }
  
    const user = data.email
      ? await this.usersService.findByEmail(data.email)
      : await this.usersService.findByPhone(data.phone);
  
    if (!user || user.otp !== data.otp) {
      throw new BadRequestException('Invalid OTP');
    }
  
    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new BadRequestException('OTP expired');
    }
  
    await this.redisService.del(verifyKey);
    await this.usersService.verifyOtp(user._id);
  
    return {
      accessToken: this.jwtService.sign({ sub: user._id }),
    };
  }
  


}
