import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthFlowController } from './auth-flow.controller';
import { AuthFlowService } from './auth-flow.service';
import { AuthCoreModule } from './auth-core.module';
import { InvitationModule } from '../invitation/invitation.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [AuthCoreModule, InvitationModule, UserModule],
  controllers: [AuthController, AuthFlowController],
  providers: [AuthFlowService],
  exports: [AuthFlowService, AuthCoreModule],
})
export class AuthModule {}