import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { RoleController } from './role.controller';
import { UserManagementService } from './user-management.service';
import { TeamModule } from '../team/team.module';

@Module({
  imports: [TeamModule],
  controllers: [UserController, RoleController],
  providers: [UserManagementService],
  exports: [UserManagementService],
})
export class UserModule {}