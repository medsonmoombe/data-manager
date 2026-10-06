import { Module } from '@nestjs/common';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';
import { KeycloakModule } from '../../infrastructure/keycloak/keycloak.module';

@Module({
  imports: [KeycloakModule],
  controllers: [InvitationController],
  providers: [InvitationService],
  exports: [InvitationService],
})
export class InvitationModule {}
