import { Module } from '@nestjs/common';
import { FormBuilderController } from './form-builder.controller';
import { SubmissionService } from './services/submission.service';
import { MinioModule } from '../../infrastructure/minio/minio.module';

@Module({
  imports: [MinioModule],
  controllers: [FormBuilderController],
  providers: [SubmissionService],
  exports: [SubmissionService],
})
export class FormBuilderModule {}