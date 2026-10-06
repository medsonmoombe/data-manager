import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { BaseCrudService } from '../../../common/base/base-crud.service';
import { Connector } from '@prisma/client';

@Injectable()
export class ConnectorCrudService extends BaseCrudService<Connector, any, any> {
  constructor(prisma: PrismaService) {
    super(prisma, 'connector');
  }
}