import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule as NestJwtModule, JwtSignOptions } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Self-issued JWT auth (replaces the Keycloak module).
 *
 * Global so any module can inject `TokenService` / `JwtAuthGuard` without wiring
 * imports through the whole dependency graph.
 */
@Global()
@Module({
  imports: [
    NestJwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // Env values are runtime strings; the `ms` StringValue type cannot be
          // expressed statically, so cast at this single boundary.
          expiresIn: config.get<string>('JWT_ACCESS_TTL', '15m') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  providers: [TokenService, JwtAuthGuard],
  exports: [TokenService, JwtAuthGuard, NestJwtModule],
})
export class JwtModule {}
