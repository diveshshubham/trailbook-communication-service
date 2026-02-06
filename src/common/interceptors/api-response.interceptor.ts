import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../../utils/api-response';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((body) => {
        // If route already returns the standard shape, keep it untouched.
        if (
          body &&
          typeof body === 'object' &&
          typeof body.success === 'boolean' &&
          typeof body.message === 'string'
        ) {
          return body;
        }

        return ApiResponse.success('OK', body);
      }),
    );
  }
}

