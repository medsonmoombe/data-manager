import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateRelationshipDto {
  @IsString()
  sourceEntityType!: string;

  @IsString()
  sourceRecordId!: string;

  @IsString()
  targetEntityType!: string;

  @IsString()
  targetRecordId!: string;

  @IsString()
  relationshipType!: string;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}