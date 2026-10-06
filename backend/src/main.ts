import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import helmet from 'helmet';
import compression from 'compression';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { ApiKeyUsageInterceptor } from './common/interceptors/api-key-usage.interceptor';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.enableCors({
    origin: [
      'http://localhost:5173',
      process.env.FRONTEND_URL || '',
    ].filter(Boolean),
    credentials: true,
  });
  app.use(compression());

  // Global pipes, filters, interceptors
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  const prismaService = app.get(PrismaService);
  // Keycloak-era global interceptors (UserSyncInterceptor / OrgInterceptor) are gone:
  // JwtAuthGuard now resolves the user and their org on every authenticated request.
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ApiKeyUsageInterceptor(prismaService),
    new ResponseInterceptor(),
  );

  // Prefix
  app.setGlobalPrefix('api/v1');

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  const config = new DocumentBuilder()
  .setTitle('OmniCore Africa API')
  .setDescription('Enterprise Data Platform - Multi-tenant, MDM, Forms, Intelligence')
  .setVersion('1.0.0')
  .addBearerAuth()
  .addServer('http://localhost:3000', 'Local Development')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 OmniCore API running on port ${port}/api/v1`);
}
bootstrap();