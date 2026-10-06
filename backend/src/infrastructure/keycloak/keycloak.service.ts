import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KeycloakAdminService {
  constructor(private config: ConfigService) {}

  // Will be expanded later to programmatically create realms, users, etc.
}