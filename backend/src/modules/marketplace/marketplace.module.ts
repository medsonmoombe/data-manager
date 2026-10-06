import { Module, OnModuleInit } from '@nestjs/common';
import { MarketplaceController } from './marketplace.controller';
import { TemplateInstallerService } from './template-installer.service';

@Module({
  controllers: [MarketplaceController],
  providers: [TemplateInstallerService],
  exports: [TemplateInstallerService],
})
export class MarketplaceModule implements OnModuleInit {
  constructor(private readonly templateInstaller: TemplateInstallerService) {}

  async onModuleInit() {
    // Auto-seed official templates on startup
    await this.templateInstaller.seedOfficialTemplates();
  }
}