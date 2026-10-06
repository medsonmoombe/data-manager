import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthFlowController } from './auth-flow.controller';
import { AuthFlowService } from './auth-flow.service';
import { InvitationService } from './invitation.service';
import { EmailOtpService } from './services/email-otp.service';
import { KeycloakModule } from '../../infrastructure/keycloak/keycloak.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [KeycloakModule, UserModule],
  controllers: [AuthController, AuthFlowController],
  providers: [InvitationService, AuthFlowService, EmailOtpService],
  exports: [InvitationService, AuthFlowService, EmailOtpService],
})
export class AuthModule {}