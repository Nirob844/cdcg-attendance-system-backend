import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateEmployeeLoanDto {
  @IsString()
  user_id: string;

  @IsNumber()
  loan_amount: number;

  @IsOptional()
  @IsString()
  loan_purpose?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
