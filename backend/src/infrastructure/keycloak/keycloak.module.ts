import { Module } from '@nestjs/common';
import { KeycloakConnectModule, PolicyEnforcementMode } from 'nest-keycloak-connect';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KeycloakAdminService } from './keycloak.admin.service';

@Module({
  imports: [
    KeycloakConnectModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        authServerUrl: config.getOrThrow<string>('KEYCLOAK_URL'),
        realm: config.getOrThrow<string>('KEYCLOAK_REALM'),
        clientId: config.getOrThrow<string>('KEYCLOAK_CLIENT_ID'),
        secret: config.getOrThrow<string>('KEYCLOAK_CLIENT_SECRET'),
        policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
      }),
    }),
  ],
  providers: [KeycloakAdminService],
  exports: [KeycloakConnectModule, KeycloakAdminService],
})
export class KeycloakModule {}