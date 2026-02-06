import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ ENABLE CORS
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  // ✅ GLOBAL VALIDATION
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ✅ GLOBAL RESPONSE + ERROR SHAPE
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // ✅ API PREFIX
  app.setGlobalPrefix('api');

  // ✅ BACKEND PORT (MATCH FRONTEND EXPECTATION)
  const port = process.env.PORT || 3002;
  await app.listen(port);

  console.log(`🚀 Server started on http://localhost:${port}/api`);
}
bootstrap();
