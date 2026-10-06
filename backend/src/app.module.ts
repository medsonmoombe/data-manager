import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { JwtModule } from './infrastructure/jwt/jwt.module';
import { AuthCoreModule } from './modules/auth/auth-core.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { HealthModule } from './modules/health/health.module';
import { ConnectorModule } from './modules/connector/connector.module';
import { SystemModule } from './modules/system/system.module';
import { MdmModule } from './modules/mdm/mdm.module';
import { FormBuilderModule } from './modules/form-builder/form-builder.module';
import { IntelligenceModule } from './modules/intellegence/intelligence.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { ValidationModule } from './modules/validation/validation.module';
import { SearchModule } from './modules/search/search.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { NotificationModule } from './modules/notification/notification.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ActivityModule } from './modules/activity/activity.module';
import { AnomalyModule } from './modules/anomaly/anomaly.module';
import { EncryptionService } from './common/services/encryption.service';
import { PublicModule } from './modules/public/public.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { CompositeAuthGuard } from './common/guards/composite-auth.guard';
import { ApiKeyScopeGuard } from './common/guards/api-key-scope.guard';
import { ApiKeyRateLimitGuard } from './common/guards/api-key-rate-limit.guard';
import { ApiKeyMaskingInterceptor } from './common/interceptors/api-key-masking.interceptor';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { TeamModule } from './modules/team/team.module';
import { InvitationModule } from './modules/invitation/invitation.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { AuditModule } from './modules/audit/audit.module';
import { GatewayModule } from './gateway/gateway.module';
import { MinioModule } from './infrastructure/minio/minio.module';
import { FilesModule } from './modules/files/files.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AuditContextInterceptor } from './common/interceptors/audit-context.interceptor';
import { IpWhitelistGuard } from './common/guards/ip-whitelist.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        if (process.env.REDIS_HOST) {
          return {
            store: redisStore,
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT ?? '6379'),
            password: process.env.REDIS_PASSWORD,
            tls: process.env.REDIS_HOST !== 'localhost' ? {} : undefined,
            ttl: 60,
          };
        }
        // No Redis configured — fall back to in-memory cache
        return { ttl: 60 };
      },
    }),
    PrismaModule,
    JwtModule,
    AuthCoreModule,
    TenantModule,
    HealthModule,
    ConnectorModule,
    SystemModule,
    MdmModule,
    FormBuilderModule,
    IntelligenceModule,
    WebhookModule,
    ValidationModule,
    SearchModule,
    WorkflowModule,
    QueueModule,
    NotificationModule,
    DashboardModule,
    ActivityModule,
    AnomalyModule,
    PublicModule,
    MarketplaceModule,
    UserModule,
    AuthModule,
    IntegrationModule,
    TeamModule,
    InvitationModule,
    SchedulerModule,
    AuditModule,
    GatewayModule,
    MinioModule,
    FilesModule,
    SettingsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyRateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CompositeAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: IpWhitelistGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyScopeGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiKeyMaskingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditContextInterceptor,
    },
    EncryptionService,
  ],
})
export class AppModule {}
