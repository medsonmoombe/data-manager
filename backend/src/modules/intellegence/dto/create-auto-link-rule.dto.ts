import { IsString, IsOptional, IsArray, IsNumber, Min, Max, IsBoolean } from 'class-validator';

class FieldMappingDto {
  @IsString()
  sourceField!: string;

  @IsString()
  targetField!: string;

  @IsString()
  matchType!: 'exact' | 'fuzzy' | 'contains';
}

export class CreateAutoLinkRuleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  sourceEntityType!: string;

  @IsString()
  targetEntityType!: string;

  @IsArray()
  fieldMappings!: FieldMappingDto[];

  @IsString()
  relationshipType!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  autoAcceptAbove?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  suggestAbove?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  priority?: number;
}