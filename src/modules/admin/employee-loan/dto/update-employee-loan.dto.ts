import { IsString, IsNumber, IsOptional } from 'class-validator';

export class UpdateEmployeeLoanDto {
  @IsOptional()
  @IsNumber()
  loan_amount?: number;

  @IsOptional()
  @IsString()
  loan_purpose?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  loan_status?: string;
}
