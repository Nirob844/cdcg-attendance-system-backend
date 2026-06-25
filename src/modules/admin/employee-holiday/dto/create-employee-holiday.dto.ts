import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class CreateEmployeeHolidayDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @IsDateString()
  @IsNotEmpty()
  end_date: string;
}
