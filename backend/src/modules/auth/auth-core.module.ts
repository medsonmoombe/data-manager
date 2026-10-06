import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { MailService } from './services/mail.service';
import { AuthTokenService } from './services/auth-token.service';

/**
 * Core identity services, global so both the auth module and the invitation
 * module can use them without importing each other (which would be circular).
 */
@Global()
@Module({
  providers: [AuthService, MailService, AuthTokenService],
  exports: [AuthService, MailService, AuthTokenService],
})
export class AuthCoreModule {}
