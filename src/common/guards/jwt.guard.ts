import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return false;

    try {
      const payload = this.jwtService.verify(token);
      req.user = payload;
      return true;
    } catch {
      return false;
    }
  }
}
