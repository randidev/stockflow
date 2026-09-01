import { NestFactory } from '@nestjs/core';
import { ValidationPipe, UnprocessableEntityException, type INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

export async function createApp(): Promise<INestApplication> {
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
            messages: Object.values(e.constraints ?? {}),
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
