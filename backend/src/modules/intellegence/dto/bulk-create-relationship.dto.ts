import { IsString, IsOptional, IsNumber, Min, Max, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkRelationshipItem {
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
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsString()
  existingSuggestionId?: string;
}

export class BulkCreateRelationshipDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkRelationshipItem)
  relationships!: BulkRelationshipItem[];
}
