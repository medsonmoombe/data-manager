import { Controller, Get, Req } from '@nestjs/common';
import { Public } from 'nest-keycloak-connect';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('me')
  getProfile(@Req() req: any) {
    return req.user;
  }
}