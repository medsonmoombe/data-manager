import { Module } from '@nestjs/common';
import { IpWhitelistController } from './ip-whitelist.controller';

@Module({
  controllers: [IpWhitelistController],
})
export class SettingsModule {}