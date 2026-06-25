import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { AttendanceStatus } from './attendance-status.enum';

export class CreateAttendanceDto {
  @IsString()
  user_id: string;

  @IsString()
  project_id: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsDateString()
  start_time?: string;

  @IsOptional()
  @IsDateString()
  lunch_start?: string;

  @IsOptional()
  @IsDateString()
  lunch_end?: string;

  @IsOptional()
  @IsDateString()
  end_time?: string;

  @IsNumber()
  @IsOptional()
  hours: number;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  attendance_status?: AttendanceStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
