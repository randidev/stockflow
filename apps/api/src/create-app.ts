import { NestFactory } from '@nestjs/core';
import { ValidationPipe, UnprocessableEntityException, type INestApplication, type ValidationError } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DATABASE_URL'] as const;

function assertRequiredEnvVars() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}. See .env.example.`);
  }
}

// Collects constraint messages for a field, including ones nested under
// ValidateNested (e.g. an invalid entry inside an `items[]` array) — a plain
// e.constraints lookup misses those and silently reports an empty list.
function collectMessages(error: ValidationError): string[] {
  const own = Object.values(error.constraints ?? {});
  const nested = (error.children ?? []).flatMap(collectMessages);
  return [...own, ...nested];
}

export async function createApp(): Promise<INestApplication> {
  assertRequiredEnvVars();

  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (validationErrors) =>
        new UnprocessableEntityException({
          message: 'Validation failed',
          errors: validationErrors.map((e) => ({
            field: e.property,
            messages: collectMessages(e),
          })),
        }),
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('StockFlow API')
    .setDescription('Inventory & invoicing API')
    .setVersion('1.0')
    .addCookieAuth('token')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  return app;
}
