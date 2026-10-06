import { IsString, IsOptional } from 'class-validator';

export class SearchDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  filters?: Record<string, any>;
}