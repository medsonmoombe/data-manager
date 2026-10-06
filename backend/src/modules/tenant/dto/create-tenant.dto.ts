import { IsString, IsOptional, IsEmail, IsUrl } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsEmail()
  primaryContactEmail?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}